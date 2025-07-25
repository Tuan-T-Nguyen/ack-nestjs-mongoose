import {
    IDatabaseCreateOptions,
    IDatabaseFindAllOptions,
    IDatabaseFindOneOptions,
    IDatabaseGetTotalOptions,
    IDatabaseSaveOptions,
    IDatabaseUpdateManyOptions,
} from '@common/database/interfaces/database.interface';
import { DatabaseService } from '@common/database/services/database.service';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { HelperNumberService } from '@common/helper/services/helper.number.service';
import { HelperStringService } from '@common/helper/services/helper.string.service';
import { ENUM_PAGINATION_ORDER_DIRECTION_TYPE } from '@common/pagination/enums/pagination.enum';
import { UserDoc } from '@modules/user/repository/entities/user.entity';
import { VerificationResponse } from '@modules/verification/dtos/response/verification.response';
import { ENUM_VERIFICATION_TYPE } from '@modules/verification/enums/verification.enum.constant';
import { IVerificationService } from '@modules/verification/interfaces/verification.service.interface';
import {
    VerificationDoc,
    VerificationEntity,
} from '@modules/verification/repository/entity/verification.entity';
import { VerificationRepository } from '@modules/verification/repository/repositories/verification.repository';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Duration } from 'luxon';
import { DeleteResult, UpdateResult } from 'mongoose';

@Injectable()
export class VerificationService implements IVerificationService {
    private readonly expiredInMinutes: number;
    private readonly otpLength: number;

    private readonly referenceLength: number;
    private readonly referencePrefix: string;

    constructor(
        private readonly verificationRepository: VerificationRepository,
        private readonly helperDateService: HelperDateService,
        private readonly helperNumberService: HelperNumberService,
        private readonly helperStringService: HelperStringService,
        private readonly configService: ConfigService,
        private readonly databaseService: DatabaseService
    ) {
        this.expiredInMinutes = this.configService.get<number>(
            'verification.expiredInMinutes'
        )!;
        this.otpLength = this.configService.get<number>(
            'verification.otpLength'
        )!;

        this.referenceLength = this.configService.get<number>(
            'verification.reference.length'
        )!;
        this.referencePrefix = this.configService.get<string>(
            'verification.reference.prefix'
        )!;
    }

    async findAll(
        find?: Record<string, any>,
        options?: IDatabaseFindAllOptions
    ): Promise<VerificationDoc[]> {
        return this.verificationRepository.findAll<VerificationDoc>(
            find,
            options
        );
    }

    async findOneById(
        _id: string,
        options?: IDatabaseFindOneOptions
    ): Promise<VerificationDoc> {
        return this.verificationRepository.findOneById<VerificationDoc>(
            _id,
            options
        );
    }

    async findOne(
        find: Record<string, any>,
        options?: IDatabaseFindOneOptions
    ): Promise<VerificationDoc> {
        return this.verificationRepository.findOne<VerificationDoc>(
            find,
            options
        );
    }

    async getTotal(
        find?: Record<string, any>,
        options?: IDatabaseGetTotalOptions
    ): Promise<number> {
        return this.verificationRepository.getTotal(find, options);
    }

    async createEmailByUser(
        user: UserDoc,
        options?: IDatabaseCreateOptions
    ): Promise<VerificationDoc> {
        const otp = this.createOtp();
        const expiredDate = this.createExpiredDate();
        const reference = this.createReference();

        const create: VerificationEntity = new VerificationEntity();
        create.user = user._id;
        create.to = user.email;
        create.type = ENUM_VERIFICATION_TYPE.EMAIL;
        create.otp = otp;
        create.expiredDate = expiredDate;
        create.isActive = true;
        create.reference = reference;

        return this.verificationRepository.create<VerificationEntity>(
            create,
            options
        );
    }

    async createMobileNumberByUser(
        user: UserDoc,
        options?: IDatabaseCreateOptions
    ): Promise<VerificationDoc> {
        const otp = this.createOtp();
        const expiredDate = this.createExpiredDate();
        const reference = this.createReference();

        const create: VerificationEntity = new VerificationEntity();
        create.user = user._id;
        create.to = user.mobileNumber!.number;
        create.type = ENUM_VERIFICATION_TYPE.MOBILE_NUMBER;
        create.otp = otp;
        create.expiredDate = expiredDate;
        create.isActive = true;
        create.reference = reference;

        return this.verificationRepository.create<VerificationEntity>(
            create,
            options
        );
    }

    async findOneLatestEmailByUser(
        user: string,
        options?: IDatabaseFindOneOptions
    ): Promise<VerificationDoc> {
        return this.verificationRepository.findOne<VerificationDoc>(
            {
                user,
                isActive: true,
                isVerify: false,
                type: ENUM_VERIFICATION_TYPE.EMAIL,
                ...this.databaseService.filterGte(
                    'expiredDate',
                    this.helperDateService.create()
                ),
            },
            {
                ...options,
                order: { createdAt: ENUM_PAGINATION_ORDER_DIRECTION_TYPE.DESC },
            }
        );
    }

    async findOneLatestMobileNumberByUser(
        user: string,
        options?: IDatabaseFindOneOptions
    ): Promise<VerificationDoc> {
        return this.verificationRepository.findOne<VerificationDoc>(
            {
                user,
                isActive: true,
                isVerify: false,
                type: ENUM_VERIFICATION_TYPE.MOBILE_NUMBER,
                ...this.databaseService.filterGte(
                    'expiredDate',
                    this.helperDateService.create()
                ),
            },
            {
                ...options,
                order: { createdAt: ENUM_PAGINATION_ORDER_DIRECTION_TYPE.DESC },
            }
        );
    }

    validateOtp(verification: VerificationDoc, otp: string): boolean {
        return verification.otp === otp;
    }

    async verify(
        repository: VerificationDoc,
        options?: IDatabaseSaveOptions
    ): Promise<VerificationDoc> {
        repository.isActive = false;
        repository.isVerify = true;
        repository.verifyDate = this.helperDateService.create();

        return this.verificationRepository.save(repository, options);
    }

    async inactiveEmailManyByUser(
        user: string,
        options?: IDatabaseUpdateManyOptions
    ): Promise<UpdateResult> {
        return this.verificationRepository.updateMany(
            { user, type: ENUM_VERIFICATION_TYPE.EMAIL },
            { isActive: false },
            options
        );
    }

    async inactiveMobileNumberManyByUser(
        user: string,
        options?: IDatabaseUpdateManyOptions
    ): Promise<UpdateResult> {
        return this.verificationRepository.updateMany(
            { user, type: ENUM_VERIFICATION_TYPE.MOBILE_NUMBER },
            { isActive: false },
            options
        );
    }

    createOtp(): string {
        return this.helperNumberService.random(this.otpLength).toString();
    }

    createExpiredDate(): Date {
        const today = this.helperDateService.create();
        return this.helperDateService.forward(
            today,
            Duration.fromObject({
                minutes: this.expiredInMinutes,
            })
        );
    }

    createReference(): string {
        const random = this.helperStringService.randomReference(
            this.referenceLength
        );

        return `${this.referencePrefix}_${random}`;
    }

    map(verification: VerificationDoc): VerificationResponse {
        return {
            expiredIn: verification.expiredDate.valueOf(),
            to: this.helperStringService.censor(verification.to),
        };
    }

    async deleteMany(
        find?: Record<string, any>,
        options?: IDatabaseUpdateManyOptions
    ): Promise<DeleteResult> {
        return this.verificationRepository.deleteMany(find, options);
    }
}
