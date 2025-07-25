import { DatabaseUUIDEntityBase } from '@common/database/bases/database.uuid.entity';
import {
    DatabaseEntity,
    DatabaseProp,
    DatabaseSchema,
} from '@common/database/decorators/database.decorator';
import { IDatabaseDocument } from '@common/database/interfaces/database.interface';
import { ENUM_POLICY_ROLE_TYPE } from '@modules/policy/enums/policy.enum';
import {
    RolePermissionEntity,
    RolePermissionSchema,
} from '@modules/role/repository/entities/role.permission.entity';

export const RoleTableName = 'Roles';

@DatabaseEntity({ collection: RoleTableName })
export class RoleEntity extends DatabaseUUIDEntityBase {
    @DatabaseProp({
        required: true,
        index: true,
        unique: true,
        trim: true,
        maxlength: 30,
        type: String,
    })
    name: string;

    @DatabaseProp({
        required: false,
        trim: true,
        type: String,
        maxlength: 500,
    })
    description?: string;

    @DatabaseProp({
        required: true,
        default: true,
        index: true,
        type: Boolean,
    })
    isActive: boolean;

    @DatabaseProp({
        required: true,
        enum: ENUM_POLICY_ROLE_TYPE,
        index: true,
        type: String,
    })
    type: ENUM_POLICY_ROLE_TYPE;

    @DatabaseProp([RolePermissionSchema])
    permissions: RolePermissionEntity[];
}

export const RoleSchema = DatabaseSchema(RoleEntity);
export type RoleDoc = IDatabaseDocument<RoleEntity>;
