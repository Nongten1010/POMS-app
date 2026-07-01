import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('officer_profiles', (table) => {
    table.specificType('regional_access_json', 'NVARCHAR(MAX) NULL');
  });

  await backfillRegionalAccess(knex, 'ศวภ.ตอ.', 'ภาคตะวันออก');
  await backfillRegionalAccess(knex, 'ศวภ.ตต.', 'ภาคตะวันตก');
  await backfillRegionalAccess(knex, 'ศวภ.ตอน.', 'ภาคตะวันออกเฉียงเหนือ');
  await backfillRegionalAccess(knex, 'ศวภ.น.', 'ภาคเหนือ');
  await backfillRegionalAccess(knex, 'ศวภ.ต.', 'ภาคใต้');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('officer_profiles', (table) => {
    table.dropColumn('regional_access_json');
  });
}

async function backfillRegionalAccess(
  knex: Knex,
  abbreviation: string,
  regionName: string,
): Promise<void> {
  await knex('officer_profiles')
    .whereNull('regional_access_json')
    .where((builder) => {
      builder
        .where('department_name_th', 'like', `%${abbreviation}%`)
        .orWhere('line_name_th', 'like', `%${abbreviation}%`);
    })
    .update({
      regional_access_json: JSON.stringify({ regions: [regionName] }),
    });
}
