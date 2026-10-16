import type { Knex } from 'knex';

export const config = { transaction: true };

// Keep deployed data migrations independent of the mutable province seed.
const CHANGES = [
  { province: 'นครนายก', previous: 'ภาคกลาง', current: 'ภาคตะวันออก' },
  { province: 'นครสวรรค์', previous: 'ภาคกลาง', current: 'ภาคเหนือ' },
  { province: 'กำแพงเพชร', previous: 'ภาคกลาง', current: 'ภาคเหนือ' },
  { province: 'ตาก', previous: 'ภาคตะวันตก', current: 'ภาคเหนือ' },
  { province: 'สุพรรณบุรี', previous: 'ภาคกลาง', current: 'ภาคตะวันตก' },
  { province: 'นครปฐม', previous: 'ภาคกลาง', current: 'ภาคตะวันตก' },
  { province: 'สมุทรสาคร', previous: 'ภาคกลาง', current: 'ภาคตะวันตก' },
  { province: 'สมุทรสงคราม', previous: 'ภาคกลาง', current: 'ภาคตะวันตก' },
] as const;

export async function up(knex: Knex): Promise<void> {
  await updateJurisdictions(knex, false);
}

export async function down(knex: Knex): Promise<void> {
  await updateJurisdictions(knex, true);
}

async function updateJurisdictions(knex: Knex, rollback: boolean): Promise<void> {
  for (const change of CHANGES) {
    const region = rollback ? change.previous : change.current;
    const provinces = knex('provinces').where('name_th', change.province);
    if (rollback) provinces.where('region', change.current);
    await provinces.update({ region });

    const snapshots = knex('cems_wpms_request_factory_snapshots')
      .whereNull('deleted_at')
      .whereExists(function activeRequest() {
        this.select(knex.raw('1'))
          .from('cems_wpms_connection_requests as request')
          .whereRaw('?? = ??', ['request.id', 'cems_wpms_request_factory_snapshots.request_id'])
          .whereNull('request.deleted_at');
      })
      .where(function snapshotProvince() {
        this.where('province_name', change.province).orWhere(function provinceCodeFallback() {
          this.where(function missingProvinceName() {
            this.whereNull('province_name').orWhere('province_name', '');
          }).whereIn('province_code', function matchingProvinceCodes() {
            this.select('id').from('provinces').where('name_th', change.province);
          });
        });
      });
    if (rollback) {
      snapshots.where({ region_name: change.current, region_code: change.current });
    } else {
      snapshots.where(function changedRegion() {
        this.whereNull('region_name')
          .orWhereNull('region_code')
          .orWhereNot('region_name', region)
          .orWhereNot('region_code', region);
      });
    }
    // These fields route connection requests; numbered KWP submission snapshots stay historical.
    await snapshots.update({
      region_name: region,
      region_code: region,
      updated_at: new Date(),
    });
  }
}
