import type { Knex } from 'knex';

interface OrgSeed {
  external_id: string;
  level: 'ministry' | 'department' | 'division' | 'organize';
  name_th: string;
  name_en?: string;
  parent_external_id?: string;
}

const ORGS: OrgSeed[] = [
  { external_id: '22', level: 'ministry', name_th: 'กระทรวงอุตสาหกรรม', name_en: 'Ministry of Industry' },
  {
    external_id: '3010000',
    level: 'department',
    name_th: 'กรมโรงงานอุตสาหกรรม',
    name_en: 'Department of Industrial Works',
    parent_external_id: '22',
  },
  {
    external_id: '3010071',
    level: 'division',
    name_th: 'ศูนย์เทคโนโลยีสารสนเทศและการสื่อสาร',
    parent_external_id: '3010000',
  },
  {
    external_id: '3010073',
    level: 'organize',
    name_th: 'กลุ่มบริการระบบสารสนเทศ 3',
    parent_external_id: '3010071',
  },
  {
    external_id: '3010080',
    level: 'division',
    name_th: 'กองบริหารจัดการมลพิษ (กฝม.)',
    parent_external_id: '3010000',
  },
  {
    external_id: '3010090',
    level: 'division',
    name_th: 'กองวิชาการมลพิษ (กวภ.)',
    parent_external_id: '3010000',
  },
  {
    external_id: '4019000',
    level: 'department',
    name_th: 'สำนักงานอุตสาหกรรมจังหวัดสระบุรี',
    parent_external_id: '22',
  },
];

export async function seed(knex: Knex): Promise<void> {
  await knex('organizations').del();
  for (const org of ORGS) {
    const parent =
      org.parent_external_id !== undefined
        ? await knex('organizations')
            .where({ external_id: org.parent_external_id })
            .first('id')
        : null;
    await knex('organizations').insert({
      external_id: org.external_id,
      level: org.level,
      name_th: org.name_th,
      name_en: org.name_en ?? null,
      parent_id: parent?.id ?? null,
    });
  }
}
