import type { Knex } from 'knex';
import { env } from '../../config/env';
import { factorySourceDb } from '../../config/factory-source-database';
import { HISTORICAL_ADDRESS_BACKUP } from './0151_create_historical_address_repair_backup';

export const config = { transaction: false };

interface HistoricalAddressRepair {
  table: 'eligible_factories' | 'factory_monitoring_point_forms' | 'cems_wpms_connection_requests';
  id: string;
  registration: string;
  originalAddress: string;
  provinceName: string;
  provinceCode: string;
  districtCode: string;
  subdistrictCode: string;
  status: string | null;
  deleted: boolean;
  districtName: string;
  subdistrictName: string;
  resolvedAddress: string;
}

interface HistoricalAddressRow {
  address: string | null;
  registration: string;
  province_name?: string | null;
  deleted_at: string | null;
  status?: string;
}

interface AreaRow {
  PROV: number | string;
  AMP: number | string;
  TUMBOL: number | string;
  TUMNAME: string | null;
  AMPNAME: string | null;
}

// Frozen from the production read-only audit, using each record's stored province and area codes.
// A historical factory may have moved; do not replace its old location with its current Fac60k one.
export const HISTORICAL_ADDRESS_REPAIRS: readonly HistoricalAddressRepair[] = [
  {
    table: 'eligible_factories',
    id: '12',
    registration: '10150000125204',
    originalAddress: '36 หมู่ 2 ถนนอยุธยา-อ่างทอง ตำบล11 อำเภอ1 14000',
    provinceName: 'อ่างทอง',
    provinceCode: '15',
    districtCode: '1',
    subdistrictCode: '11',
    status: null,
    deleted: true,
    districtName: 'เมืองอ่างทอง',
    subdistrictName: 'โพสะ',
    resolvedAddress: '36 หมู่ 2 ถนนอยุธยา-อ่างทอง ตำบลโพสะ อำเภอเมืองอ่างทอง 14000',
  },
  {
    table: 'eligible_factories',
    id: '13',
    registration: '10560000125311',
    originalAddress: '92 หมู่ 17 ตำบล4 อำเภอ6 56140',
    provinceName: 'พะเยา',
    provinceCode: '56',
    districtCode: '6',
    subdistrictCode: '4',
    status: null,
    deleted: true,
    districtName: 'ปง',
    subdistrictName: 'งิม',
    resolvedAddress: '92 หมู่ 17 ตำบลงิม อำเภอปง 56140',
  },
  {
    table: 'eligible_factories',
    id: '14',
    registration: '20860071825668',
    originalAddress: 'โฉนดที่ดินเลขที่ 43033 หมู่ 7 ตำบล4 อำเภอ4 86110',
    provinceName: 'ชุมพร',
    provinceCode: '86',
    districtCode: '4',
    subdistrictCode: '4',
    status: null,
    deleted: true,
    districtName: 'หลังสวน',
    subdistrictName: 'นาขา',
    resolvedAddress: 'โฉนดที่ดินเลขที่ 43033 หมู่ 7 ตำบลนาขา อำเภอหลังสวน 86110',
  },
  {
    table: 'eligible_factories',
    id: '15',
    registration: '20860119425661',
    originalAddress: 'โฉนดที่ดินเลขที่ 14930 หมู่ 11 ตำบล12 อำเภอ4 86110',
    provinceName: 'ชุมพร',
    provinceCode: '86',
    districtCode: '4',
    subdistrictCode: '12',
    status: null,
    deleted: true,
    districtName: 'หลังสวน',
    subdistrictName: 'วังตะกอ',
    resolvedAddress: 'โฉนดที่ดินเลขที่ 14930 หมู่ 11 ตำบลวังตะกอ อำเภอหลังสวน 86110',
  },
  {
    table: 'eligible_factories',
    id: '16',
    registration: '10190000225448',
    originalAddress: '219 หมู่ 5 ถนนมิตรภาพ ตำบล2 อำเภอ2 18260',
    provinceName: 'สระบุรี',
    provinceCode: '19',
    districtCode: '2',
    subdistrictCode: '2',
    status: null,
    deleted: true,
    districtName: 'แก่งคอย',
    subdistrictName: 'ทับกวาง',
    resolvedAddress: '219 หมู่ 5 ถนนมิตรภาพ ตำบลทับกวาง อำเภอแก่งคอย 18260',
  },
  {
    table: 'eligible_factories',
    id: '17',
    registration: '10550000125197',
    originalAddress: '189 หมู่ 10 ถนนวรนคร ตำบล6 อำเภอ6 55140',
    provinceName: 'น่าน',
    provinceCode: '55',
    districtCode: '6',
    subdistrictCode: '6',
    status: null,
    deleted: true,
    districtName: 'ท่าวังผา',
    subdistrictName: 'ศรีภูมิ',
    resolvedAddress: '189 หมู่ 10 ถนนวรนคร ตำบลศรีภูมิ อำเภอท่าวังผา 55140',
  },
  {
    table: 'eligible_factories',
    id: '18',
    registration: '10560000125584',
    originalAddress: '88/1 หมู่ 7 ถนนพะเยา-เชียงคำ ตำบล6 อำเภอ2 57000',
    provinceName: 'พะเยา',
    provinceCode: '56',
    districtCode: '2',
    subdistrictCode: '6',
    status: null,
    deleted: true,
    districtName: 'จุน',
    subdistrictName: 'ห้วยยางขาม',
    resolvedAddress: '88/1 หมู่ 7 ถนนพะเยา-เชียงคำ ตำบลห้วยยางขาม อำเภอจุน 57000',
  },
  {
    table: 'eligible_factories',
    id: '20',
    registration: '10520000225172',
    originalAddress: '1 หมู่ 9 ถนนบ้านช่องคอม ตำบล4 อำเภอ13 52240',
    provinceName: 'ลำปาง',
    provinceCode: '52',
    districtCode: '13',
    subdistrictCode: '4',
    status: null,
    deleted: true,
    districtName: 'เมืองปาน',
    subdistrictName: 'แจ้ซ้อน',
    resolvedAddress: '1 หมู่ 9 ถนนบ้านช่องคอม ตำบลแจ้ซ้อน อำเภอเมืองปาน 52240',
  },
  {
    table: 'eligible_factories',
    id: '58',
    registration: '10710100125493',
    originalAddress: '1/104 หมู่ 8 ถนนแสงชูโต ตำบล4 อำเภอ5 71120',
    provinceName: 'กาญจนบุรี',
    provinceCode: '71',
    districtCode: '5',
    subdistrictCode: '4',
    status: null,
    deleted: true,
    districtName: 'ท่ามะกา',
    subdistrictName: 'ท่าไม้',
    resolvedAddress: '1/104 หมู่ 8 ถนนแสงชูโต ตำบลท่าไม้ อำเภอท่ามะกา 71120',
  },
  {
    table: 'eligible_factories',
    id: '644',
    registration: '82170053425676',
    originalAddress: '9/19 หมู่ 4 ถนนสุขุมวิท21 ตำบล7 อำเภอ3 13260',
    provinceName: 'พระนครศรีอยุธยา',
    provinceCode: '14',
    districtCode: '3',
    subdistrictCode: '7',
    status: null,
    deleted: true,
    districtName: 'นครหลวง',
    subdistrictName: 'บางพระครู',
    resolvedAddress: '9/19 หมู่ 4 ถนนสุขุมวิท21 ตำบลบางพระครู อำเภอนครหลวง 13260',
  },
  {
    table: 'factory_monitoring_point_forms',
    id: '14',
    registration: '10550000125197',
    originalAddress: '189 หมู่ 10 ถนนวรนคร ตำบล6 อำเภอ6 จังหวัดน่าน 55140',
    provinceName: 'น่าน',
    provinceCode: '55',
    districtCode: '6',
    subdistrictCode: '6',
    status: null,
    deleted: true,
    districtName: 'ท่าวังผา',
    subdistrictName: 'ศรีภูมิ',
    resolvedAddress: '189 หมู่ 10 ถนนวรนคร ตำบลศรีภูมิ อำเภอท่าวังผา จังหวัดน่าน 55140',
  },
  {
    table: 'factory_monitoring_point_forms',
    id: '17',
    registration: '10520000225172',
    originalAddress: '1 หมู่ 9 ถนนบ้านช่องคอม ตำบล4 อำเภอ13 จังหวัดลำปาง 52240',
    provinceName: 'ลำปาง',
    provinceCode: '52',
    districtCode: '13',
    subdistrictCode: '4',
    status: null,
    deleted: true,
    districtName: 'เมืองปาน',
    subdistrictName: 'แจ้ซ้อน',
    resolvedAddress: '1 หมู่ 9 ถนนบ้านช่องคอม ตำบลแจ้ซ้อน อำเภอเมืองปาน จังหวัดลำปาง 52240',
  },
  {
    table: 'factory_monitoring_point_forms',
    id: '18',
    registration: '10100700125319',
    originalAddress: '210 หมู่ 1 ซอยสุขุมวิท 64 ถนนสุขุมวิท ตำบล10 อำเภอ9 กรุงเทพมหานคร 10260',
    provinceName: 'กรุงเทพมหานคร',
    provinceCode: '10',
    districtCode: '9',
    subdistrictCode: '10',
    status: null,
    deleted: true,
    districtName: 'พระโขนง',
    subdistrictName: 'พระโขนงใต้',
    resolvedAddress:
      '210 หมู่ 1 ซอยสุขุมวิท 64 ถนนสุขุมวิท ตำบลพระโขนงใต้ อำเภอพระโขนง กรุงเทพมหานคร 10260',
  },
  {
    table: 'factory_monitoring_point_forms',
    id: '54',
    registration: '10710100125493',
    originalAddress: '1/104 หมู่ 8 ถนนแสงชูโต ตำบล4 อำเภอ5 จังหวัดกาญจนบุรี 71120',
    provinceName: 'กาญจนบุรี',
    provinceCode: '71',
    districtCode: '5',
    subdistrictCode: '4',
    status: null,
    deleted: true,
    districtName: 'ท่ามะกา',
    subdistrictName: 'ท่าไม้',
    resolvedAddress: '1/104 หมู่ 8 ถนนแสงชูโต ตำบลท่าไม้ อำเภอท่ามะกา จังหวัดกาญจนบุรี 71120',
  },
  {
    table: 'factory_monitoring_point_forms',
    id: '278',
    registration: '91120001325592',
    originalAddress: '454/16 หมู่ 9 ตำบล11 อำเภอ2 จังหวัดปราจีนบุรี 25110',
    provinceName: 'ปราจีนบุรี',
    provinceCode: '25',
    districtCode: '2',
    subdistrictCode: '11',
    status: null,
    deleted: true,
    districtName: 'กบินทร์บุรี',
    subdistrictName: 'หนองกี่',
    resolvedAddress: '454/16 หมู่ 9 ตำบลหนองกี่ อำเภอกบินทร์บุรี จังหวัดปราจีนบุรี 25110',
  },
  {
    table: 'factory_monitoring_point_forms',
    id: '640',
    registration: '82170053425676',
    originalAddress: '9/19 หมู่ 4 ถนนสุขุมวิท21 ตำบล7 อำเภอ3 จังหวัดพระนครศรีอยุธยา 13260',
    provinceName: 'พระนครศรีอยุธยา',
    provinceCode: '14',
    districtCode: '3',
    subdistrictCode: '7',
    status: null,
    deleted: true,
    districtName: 'นครหลวง',
    subdistrictName: 'บางพระครู',
    resolvedAddress:
      '9/19 หมู่ 4 ถนนสุขุมวิท21 ตำบลบางพระครู อำเภอนครหลวง จังหวัดพระนครศรีอยุธยา 13260',
  },
  {
    table: 'cems_wpms_connection_requests',
    id: '10345',
    registration: '82250600225587',
    originalAddress: '7/507 หมู่ 6 ตำบล5 อำเภอ6 จังหวัดระยอง 21140',
    provinceName: 'ระยอง',
    provinceCode: '21',
    districtCode: '6',
    subdistrictCode: '5',
    status: 'CANCELED',
    deleted: false,
    districtName: 'ปลวกแดง',
    subdistrictName: 'มาบยางพร',
    resolvedAddress: '7/507 หมู่ 6 ตำบลมาบยางพร อำเภอปลวกแดง จังหวัดระยอง 21140',
  },
  {
    table: 'cems_wpms_connection_requests',
    id: '10346',
    registration: '82250600225587',
    originalAddress: '7/507 หมู่ 6 ตำบล5 อำเภอ6 จังหวัดระยอง 21140',
    provinceName: 'ระยอง',
    provinceCode: '21',
    districtCode: '6',
    subdistrictCode: '5',
    status: 'CANCELED',
    deleted: false,
    districtName: 'ปลวกแดง',
    subdistrictName: 'มาบยางพร',
    resolvedAddress: '7/507 หมู่ 6 ตำบลมาบยางพร อำเภอปลวกแดง จังหวัดระยอง 21140',
  },
];

export async function up(knex: Knex): Promise<void> {
  await verifyAdministrativeNames();
  const groups = new Map<
    string,
    Array<{ repair: HistoricalAddressRepair; before: HistoricalAddressRow }>
  >();
  for (const repair of HISTORICAL_ADDRESS_REPAIRS) {
    const request = repair.table === 'cems_wpms_connection_requests';
    const before = await knex<HistoricalAddressRow>(repair.table)
      .where('id', repair.id)
      .first(
        'address',
        // Preserve DATETIME2(7) precision for the backup and compare-and-set guard.
        knex.raw('CONVERT(VARCHAR(33), ??, 126) AS ??', ['deleted_at', 'deleted_at']),
        `${request ? 'factory_id' : 'factory_registration_no_new'} as registration`,
        request ? 'status' : 'province_name',
      );
    if (!before || before.registration !== repair.registration) throw staleRepair(repair);
    if (before.address === repair.resolvedAddress) continue;
    if (
      before.address !== repair.originalAddress ||
      (before.deleted_at != null) !== repair.deleted ||
      (request ? before.status !== repair.status : before.province_name !== repair.provinceName)
    ) {
      throw staleRepair(repair);
    }
    const group = groups.get(repair.registration) ?? [];
    group.push({ repair, before });
    groups.set(repair.registration, group);
  }
  for (const group of groups.values()) {
    await knex.transaction(async (trx) => {
      for (const { repair, before } of group) {
        const existing = await trx(HISTORICAL_ADDRESS_BACKUP)
          .where({ target_table: repair.table, entity_id: repair.id })
          .first();
        if (existing) throw staleRepair(repair);
        const request = repair.table === 'cems_wpms_connection_requests';
        const query = trx(repair.table)
          .where('id', repair.id)
          .where('address', repair.originalAddress)
          .where(request ? 'factory_id' : 'factory_registration_no_new', repair.registration);
        if (repair.deleted) query.where('deleted_at', before.deleted_at);
        else query.whereNull('deleted_at');
        if (request) query.where('status', repair.status);
        else query.where('province_name', repair.provinceName);
        const affected = await query.update({ address: repair.resolvedAddress });
        if (affected !== 1) throw staleRepair(repair);
        await trx(HISTORICAL_ADDRESS_BACKUP).insert({
          target_table: repair.table,
          entity_id: repair.id,
          registration_no: repair.registration,
          original_address: repair.originalAddress,
          resolved_address: repair.resolvedAddress,
          original_deleted_at: before.deleted_at,
          original_status: before.status ?? null,
          administrative_area_key: areaKey(
            repair.provinceCode,
            repair.districtCode,
            repair.subdistrictCode,
          ),
        });
      }
    });
  }
}

async function verifyAdministrativeNames(): Promise<void> {
  const rows = await factorySourceDb<AreaRow>(`${env.FACTORY_DB_SCHEMA}.TUMBOL`)
    .whereIn('PROV', [...new Set(HISTORICAL_ADDRESS_REPAIRS.map((repair) => repair.provinceCode))])
    .timeout(30000)
    .select('PROV', 'AMP', 'TUMBOL', 'TUMNAME', 'AMPNAME');
  const names = new Map<string, AreaRow>();
  for (const row of rows) {
    const key = areaKey(row.PROV, row.AMP, row.TUMBOL);
    const previous = names.get(key);
    if (
      previous &&
      (previous.TUMNAME?.trim() !== row.TUMNAME?.trim() ||
        previous.AMPNAME?.trim() !== row.AMPNAME?.trim())
    ) {
      throw new Error(`Ambiguous historical administrative area: ${key}`);
    }
    names.set(key, row);
  }
  for (const repair of HISTORICAL_ADDRESS_REPAIRS) {
    const key = areaKey(repair.provinceCode, repair.districtCode, repair.subdistrictCode);
    const source = names.get(key);
    const originalDistrict = /อำเภอ\s*(\d+)(?=\s|$)/u.exec(repair.originalAddress)?.[1];
    const originalSubdistrict = /ตำบล\s*(\d+)(?=\s|$)/u.exec(repair.originalAddress)?.[1];
    const resolved = repair.originalAddress
      .replace(/ตำบล\s*\d+(?=\s|$)/u, `ตำบล${repair.subdistrictName}`)
      .replace(/อำเภอ\s*\d+(?=\s|$)/u, `อำเภอ${repair.districtName}`);
    if (
      Number(originalDistrict) !== Number(repair.districtCode) ||
      Number(originalSubdistrict) !== Number(repair.subdistrictCode) ||
      source?.TUMNAME?.trim() !== repair.subdistrictName ||
      source?.AMPNAME?.trim() !== repair.districtName ||
      resolved !== repair.resolvedAddress ||
      !repair.resolvedAddress.trim() ||
      repair.resolvedAddress.length > 1000 ||
      /(?:ตำบล|อำเภอ)\s*\d+(?=\s|$)/u.test(repair.resolvedAddress)
    ) {
      throw new Error(
        `Cannot verify historical administrative names: ${repair.table}:${repair.id}`,
      );
    }
  }
}

function areaKey(
  province: number | string,
  district: number | string,
  subdistrict: number | string,
): string {
  return `${Number(province)}:${Number(district)}:${Number(subdistrict)}`;
}

function staleRepair(repair: HistoricalAddressRepair): Error {
  return new Error(
    `Historical address changed; review before retrying: ${repair.table}:${repair.id}`,
  );
}

export async function down(): Promise<void> {
  throw new Error(
    'Historical address repair is irreversible; retain backups and use a reviewed forward migration',
  );
}
