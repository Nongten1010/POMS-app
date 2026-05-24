import type { Knex } from 'knex';
import bcrypt from 'bcrypt';
import {
  MOCK_OFFICERS,
  MOCK_OPERATORS,
  MOCK_CITIZENS,
} from '../../modules/auth/fixtures/mock-users';

const SALT_ROUNDS = 10; // seed-only; production uses BCRYPT_SALT_ROUNDS from env

async function upsertUser(
  knex: Knex,
  payload: {
    external_id: string;
    user_type: 'citizen' | 'operator' | 'officer' | 'admin';
    username: string | null;
    email: string | null;
    phone: string | null;
    prename_th: string | null;
    first_name: string;
    last_name: string;
    password: string;
  },
): Promise<number> {
  const passwordHash = await bcrypt.hash(payload.password, SALT_ROUNDS);
  const existing = await knex('users')
    .where({ identity_provider: 'mock', external_id: payload.external_id })
    .first('id');
  if (existing) {
    await knex('users').where({ id: existing.id }).update({
      username: payload.username,
      email: payload.email,
      phone: payload.phone,
      prename_th: payload.prename_th,
      first_name: payload.first_name,
      last_name: payload.last_name,
      password_hash: Buffer.from(passwordHash, 'utf8'),
      updated_at: knex.raw('SYSDATETIME()'),
    });
    return existing.id;
  }
  const [{ id }] = await knex('users')
    .insert({
      external_id: payload.external_id,
      identity_provider: 'mock',
      user_type: payload.user_type,
      username: payload.username,
      email: payload.email,
      phone: payload.phone,
      prename_th: payload.prename_th,
      first_name: payload.first_name,
      last_name: payload.last_name,
      password_hash: Buffer.from(passwordHash, 'utf8'),
      is_active: true,
    })
    .returning('id');
  return id;
}

async function assignRoles(knex: Knex, userId: number, roleCodes: string[]): Promise<void> {
  const roles = await knex('roles').whereIn('code', roleCodes).select('id', 'code');
  for (const role of roles) {
    const exists = await knex('user_roles')
      .where({ user_id: userId, role_id: role.id })
      .first();
    if (!exists) {
      await knex('user_roles').insert({ user_id: userId, role_id: role.id });
    }
  }
}

export async function seed(knex: Knex): Promise<void> {
  for (const officer of MOCK_OFFICERS) {
    const userType = officer.roles.includes('admin') ? 'admin' : 'officer';
    const userId = await upsertUser(knex, {
      external_id: officer.external_id,
      user_type: userType,
      username: officer.username,
      email: officer.email,
      phone: officer.phone,
      prename_th: officer.prename_th,
      first_name: officer.first_name,
      last_name: officer.last_name,
      password: officer.password,
    });

    // upsert officer_profile
    const existingProfile = await knex('officer_profiles').where({ user_id: userId }).first();
    const profileData = { user_id: userId, ...officer.profile, synced_at: knex.raw('SYSDATETIME()') };
    if (existingProfile) {
      await knex('officer_profiles').where({ user_id: userId }).update(officer.profile);
    } else {
      await knex('officer_profiles').insert(profileData);
    }

    await assignRoles(knex, userId, officer.roles);
  }

  for (const operator of MOCK_OPERATORS) {
    const userId = await upsertUser(knex, {
      external_id: operator.citizen_id,
      user_type: 'operator',
      username: null,
      email: operator.email,
      phone: operator.phone,
      prename_th: null,
      first_name: operator.first_name,
      last_name: operator.last_name,
      password: operator.password,
    });

    const existingProfile = await knex('operator_profiles').where({ user_id: userId }).first();
    if (existingProfile) {
      await knex('operator_profiles').where({ user_id: userId }).update({
        user_code: operator.user_code,
        regis_date: operator.regis_date,
      });
    } else {
      await knex('operator_profiles').insert({
        user_id: userId,
        user_code: operator.user_code,
        regis_date: operator.regis_date,
      });
    }

    await assignRoles(knex, userId, operator.roles);
  }

  for (const citizen of MOCK_CITIZENS) {
    const userId = await upsertUser(knex, {
      external_id: citizen.external_id,
      user_type: 'citizen',
      username: citizen.username,
      email: citizen.email,
      phone: null,
      prename_th: null,
      first_name: citizen.first_name,
      last_name: citizen.last_name,
      password: citizen.password,
    });
    await assignRoles(knex, userId, citizen.roles);
  }
}
