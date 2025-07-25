import {
    BadRequestException,
    Body,
    ConflictException,
    Controller,
    Get,
    InternalServerErrorException,
    NotFoundException,
    Param,
    Patch,
    Post,
    Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationService } from '@common/pagination/services/pagination.service';
import {
    Response,
    ResponsePaging,
} from '@common/response/decorators/response.decorator';
import {
    IResponse,
    IResponsePaging,
} from '@common/response/interfaces/response.interface';
import { PaginationListDto } from '@common/pagination/dtos/pagination.list.dto';
import {
    PaginationQuery,
    PaginationQueryFilterEqual,
    PaginationQueryFilterIn,
    PaginationQueryFilterInEnum,
} from '@common/pagination/decorators/pagination.decorator';
import {
    PolicyAbilityProtected,
    PolicyRoleProtected,
} from '@modules/policy/decorators/policy.decorator';
import {
    ENUM_POLICY_ACTION,
    ENUM_POLICY_ROLE_TYPE,
    ENUM_POLICY_SUBJECT,
} from '@modules/policy/enums/policy.enum';
import { ApiKeyProtected } from '@modules/api-key/decorators/api-key.decorator';
import {
    AuthJwtAccessProtected,
    AuthJwtPayload,
} from '@modules/auth/decorators/auth.jwt.decorator';
import { RequestRequiredPipe } from '@common/request/pipes/request.required.pipe';
import { RoleService } from '@modules/role/services/role.service';
import { ENUM_ROLE_STATUS_CODE_ERROR } from '@modules/role/enums/role.status-code.enum';
import { IAuthPassword } from '@modules/auth/interfaces/auth.interface';
import { AuthService } from '@modules/auth/services/auth.service';
import { ClientSession } from 'mongoose';
import { ENUM_COUNTRY_STATUS_CODE_ERROR } from '@modules/country/enums/country.status-code.enum';
import { CountryService } from '@modules/country/services/country.service';
import {
    UserAdminCreateDoc,
    UserAdminGetDoc,
    UserAdminListDoc,
    UserAdminUpdateDoc,
    UserAdminUpdateStatusDoc,
} from '@modules/user/docs/user.admin.doc';
import {
    ENUM_USER_SIGN_UP_FROM,
    ENUM_USER_STATUS,
} from '@modules/user/enums/user.enum';
import { UserListResponseDto } from '@modules/user/dtos/response/user.list.response.dto';
import { UserParsePipe } from '@modules/user/pipes/user.parse.pipe';
import { UserProfileResponseDto } from '@modules/user/dtos/response/user.profile.response.dto';
import { UserService } from '@modules/user/services/user.service';
import {
    USER_DEFAULT_AVAILABLE_SEARCH,
    USER_DEFAULT_STATUS,
} from '@modules/user/constants/user.list.constant';
import { IUserDoc, IUserEntity } from '@modules/user/interfaces/user.interface';
import { UserDoc } from '@modules/user/repository/entities/user.entity';
import { UserCreateRequestDto } from '@modules/user/dtos/request/user.create.request.dto';
import { ENUM_USER_STATUS_CODE_ERROR } from '@modules/user/enums/user.status-code.enum';
import { UserNotSelfPipe } from '@modules/user/pipes/user.not-self.pipe';
import { UserUpdateRequestDto } from '@modules/user/dtos/request/user.update.request.dto';
import { ENUM_APP_STATUS_CODE_ERROR } from '@app/enums/app.status-code.enum';
import { DatabaseIdResponseDto } from '@common/database/dtos/response/database.id.response.dto';
import { ENUM_SEND_EMAIL_PROCESS } from '@modules/email/enums/email.enum';
import { Queue } from 'bullmq';
import { ENUM_WORKER_QUEUES } from '@workers/enums/worker.enum';
import { PasswordHistoryService } from '@modules/password-history/services/password-history.service';
import { ENUM_PASSWORD_HISTORY_TYPE } from '@modules/password-history/enums/password-history.enum';
import { ActivityService } from '@modules/activity/services/activity.service';
import { MessageService } from '@common/message/services/message.service';
import { InjectQueue } from '@nestjs/bullmq';
import { UserUpdateStatusRequestDto } from '@modules/user/dtos/request/user.update-status.request.dto';
import { VerificationService } from '@modules/verification/services/verification.service';
import { UserProtected } from '@modules/user/decorators/user.decorator';
import { DatabaseService } from '@common/database/services/database.service';

@ApiTags('modules.admin.user')
@Controller({
    version: '1',
    path: '/user',
})
export class UserAdminController {
    constructor(
        private readonly databaseService: DatabaseService,
        @InjectQueue(ENUM_WORKER_QUEUES.EMAIL_QUEUE)
        private readonly emailQueue: Queue,
        private readonly paginationService: PaginationService,
        private readonly roleService: RoleService,
        private readonly authService: AuthService,
        private readonly userService: UserService,
        private readonly countryService: CountryService,
        private readonly passwordHistoryService: PasswordHistoryService,
        private readonly activityService: ActivityService,
        private readonly messageService: MessageService,
        private readonly verificationService: VerificationService
    ) {}

    @UserAdminListDoc()
    @ResponsePaging('user.list')
    @PolicyAbilityProtected({
        subject: ENUM_POLICY_SUBJECT.USER,
        action: [ENUM_POLICY_ACTION.READ],
    })
    @PolicyRoleProtected(ENUM_POLICY_ROLE_TYPE.ADMIN)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('/list')
    async list(
        @PaginationQuery({
            availableSearch: USER_DEFAULT_AVAILABLE_SEARCH,
        })
        { _search, _limit, _offset, _order }: PaginationListDto,
        @PaginationQueryFilterInEnum(
            'status',
            USER_DEFAULT_STATUS,
            ENUM_USER_STATUS
        )
        status: Record<string, any>,
        @PaginationQueryFilterIn('role')
        role: Record<string, any>,
        @PaginationQueryFilterEqual('country')
        country: Record<string, any>
    ): Promise<IResponsePaging<UserListResponseDto>> {
        const find: Record<string, any> = {
            ..._search,
            ...status,
            ...role,
            ...country,
        };

        const users: IUserEntity[] =
            await this.userService.findAllWithRoleAndCountry(find, {
                paging: {
                    limit: _limit,
                    offset: _offset,
                },
                order: _order,
            });
        const total: number =
            await this.userService.getTotalWithRoleAndCountry(find);
        const totalPage: number = this.paginationService.totalPage(
            total,
            _limit
        );

        const mapped = this.userService.mapList(users);

        return {
            _pagination: { total, totalPage },
            data: mapped,
        };
    }

    @UserAdminGetDoc()
    @Response('user.get')
    @PolicyAbilityProtected({
        subject: ENUM_POLICY_SUBJECT.USER,
        action: [ENUM_POLICY_ACTION.READ],
    })
    @PolicyRoleProtected(ENUM_POLICY_ROLE_TYPE.ADMIN)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('/get/:user')
    async get(
        @Param('user', RequestRequiredPipe, UserParsePipe) user: UserDoc
    ): Promise<IResponse<UserProfileResponseDto>> {
        const userWithRole: IUserDoc = await this.userService.join(user);
        const mapped: UserProfileResponseDto =
            this.userService.mapProfile(userWithRole);

        return { data: mapped };
    }

    @UserAdminCreateDoc()
    @Response('user.create')
    @PolicyAbilityProtected({
        subject: ENUM_POLICY_SUBJECT.USER,
        action: [ENUM_POLICY_ACTION.READ, ENUM_POLICY_ACTION.CREATE],
    })
    @PolicyRoleProtected(ENUM_POLICY_ROLE_TYPE.ADMIN)
    @UserProtected()
    @AuthJwtAccessProtected()
    @Post('/create')
    async create(
        @AuthJwtPayload('user') createBy: string,
        @Body()
        { email, role, name, country, gender }: UserCreateRequestDto
    ): Promise<IResponse<DatabaseIdResponseDto>> {
        const promises: Promise<any>[] = [
            this.roleService.findOneById(role),
            this.userService.existByEmail(email),
            this.countryService.findOneById(country),
        ];

        const [checkRole, emailExist, checkCountry] =
            await Promise.all(promises);

        if (!checkRole) {
            throw new NotFoundException({
                statusCode: ENUM_ROLE_STATUS_CODE_ERROR.NOT_FOUND,
                message: 'role.error.notFound',
            });
        } else if (!checkCountry) {
            throw new NotFoundException({
                statusCode: ENUM_COUNTRY_STATUS_CODE_ERROR.NOT_FOUND,
                message: 'country.error.notFound',
            });
        } else if (emailExist) {
            throw new ConflictException({
                statusCode: ENUM_USER_STATUS_CODE_ERROR.EMAIL_EXIST,
                message: 'user.error.emailExist',
            });
        }

        const passwordString = this.authService.createPasswordRandom();
        const password: IAuthPassword = this.authService.createPassword(
            passwordString,
            {
                temporary: true,
            }
        );

        const session: ClientSession =
            await this.databaseService.createTransaction();

        try {
            const created = await this.userService.create(
                {
                    email,
                    country,
                    role,
                    name,
                    gender,
                },
                password,
                ENUM_USER_SIGN_UP_FROM.ADMIN,
                { session }
            );

            const verification =
                await this.verificationService.createEmailByUser(created, {
                    session,
                });
            await this.passwordHistoryService.createByAdmin(
                created,
                {
                    by: createBy,
                    type: ENUM_PASSWORD_HISTORY_TYPE.SIGN_UP,
                },
                { session }
            );
            await this.activityService.createByAdmin(
                created,
                {
                    by: createBy,
                    description: this.messageService.setMessage(
                        'activity.user.createByAdmin'
                    ),
                },
                { session }
            );

            await Promise.all([
                this.emailQueue.add(
                    ENUM_SEND_EMAIL_PROCESS.CREATE,
                    {
                        send: { email: created.email, name: created.name },
                        data: {
                            passwordExpiredAt: password.passwordExpired,
                            password: passwordString,
                        },
                    },
                    {
                        debounce: {
                            id: `${ENUM_SEND_EMAIL_PROCESS.CREATE}-${created._id}`,
                            ttl: 1000,
                        },
                    }
                ),
                this.emailQueue.add(
                    ENUM_SEND_EMAIL_PROCESS.VERIFICATION,
                    {
                        send: { email, name },
                        data: {
                            otp: verification.otp,
                            expiredAt: verification.expiredDate,
                            reference: verification.reference,
                        },
                    },
                    {
                        debounce: {
                            id: `${ENUM_SEND_EMAIL_PROCESS.VERIFICATION}-${created._id}`,
                            ttl: 1000,
                        },
                    }
                ),
            ]);

            await this.databaseService.commitTransaction(session);

            return {
                data: { _id: created._id },
            };
        } catch (err: unknown) {
            await this.databaseService.abortTransaction(session);

            throw new InternalServerErrorException({
                statusCode: ENUM_APP_STATUS_CODE_ERROR.UNKNOWN,
                message: 'http.serverError.internalServerError',
                _error: err,
            });
        }
    }

    @UserAdminUpdateDoc()
    @Response('user.update')
    @PolicyAbilityProtected({
        subject: ENUM_POLICY_SUBJECT.USER,
        action: [ENUM_POLICY_ACTION.READ, ENUM_POLICY_ACTION.UPDATE],
    })
    @PolicyRoleProtected(ENUM_POLICY_ROLE_TYPE.ADMIN)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Put('/update/:user')
    async update(
        @Param('user', RequestRequiredPipe, UserParsePipe, UserNotSelfPipe)
        user: UserDoc,
        @Body() { name, country, role, gender }: UserUpdateRequestDto
    ): Promise<void> {
        const checkRole = await this.roleService.findOneActiveById(role);
        if (!checkRole) {
            throw new NotFoundException({
                statusCode: ENUM_ROLE_STATUS_CODE_ERROR.NOT_FOUND,
                message: 'role.error.notFound',
            });
        }

        const checkCountry = await this.countryService.findOneById(country);
        if (!checkCountry) {
            throw new NotFoundException({
                statusCode: ENUM_COUNTRY_STATUS_CODE_ERROR.NOT_FOUND,
                message: 'country.error.notFound',
            });
        }

        const session: ClientSession =
            await this.databaseService.createTransaction();

        try {
            await this.userService.update(
                user,
                { name, country, role, gender },
                { session }
            );

            await this.activityService.createByUser(
                user,
                {
                    description: this.messageService.setMessage(
                        'activity.user.updateByAdmin'
                    ),
                },
                { session }
            );

            await this.databaseService.commitTransaction(session);
        } catch (err: unknown) {
            await this.databaseService.abortTransaction(session);

            throw new InternalServerErrorException({
                statusCode: ENUM_APP_STATUS_CODE_ERROR.UNKNOWN,
                message: 'http.serverError.internalServerError',
                _error: err,
            });
        }
    }

    @UserAdminUpdateStatusDoc()
    @Response('user.updateStatus')
    @PolicyAbilityProtected({
        subject: ENUM_POLICY_SUBJECT.USER,
        action: [ENUM_POLICY_ACTION.READ, ENUM_POLICY_ACTION.UPDATE],
    })
    @PolicyRoleProtected(ENUM_POLICY_ROLE_TYPE.ADMIN)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Patch('/update/:user/status')
    async updateStatus(
        @Param('user', RequestRequiredPipe, UserParsePipe, UserNotSelfPipe)
        user: UserDoc,
        @Body() { status }: UserUpdateStatusRequestDto
    ): Promise<IResponse<void>> {
        if (user.status === ENUM_USER_STATUS.BLOCKED) {
            throw new BadRequestException({
                statusCode: ENUM_USER_STATUS_CODE_ERROR.STATUS_INVALID,
                message: 'user.error.statusInvalid',
                _metadata: {
                    customProperty: {
                        messageProperties: {
                            status: status.toLowerCase(),
                        },
                    },
                },
            });
        }

        const session: ClientSession =
            await this.databaseService.createTransaction();

        try {
            await this.userService.updateStatus(user, { status }, { session });

            await this.activityService.createByUser(
                user,
                {
                    description: this.messageService.setMessage(
                        `activity.user.${status.toLowerCase()}ByAdmin`
                    ),
                },
                { session }
            );

            await this.databaseService.commitTransaction(session);

            return {
                _metadata: {
                    customProperty: {
                        messageProperties: {
                            status: status.toLowerCase(),
                        },
                    },
                },
            };
        } catch (err: unknown) {
            await this.databaseService.abortTransaction(session);

            throw new InternalServerErrorException({
                statusCode: ENUM_APP_STATUS_CODE_ERROR.UNKNOWN,
                message: 'http.serverError.internalServerError',
                _error: err,
            });
        }
    }
}
