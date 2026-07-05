import type { Knex } from 'knex';
import { addAuditColumns } from '../migration-helpers';

const TABLE_NAME = 'officer_notification_email_recipients';

const IEAT_EMAILS = ['contact@ieat.mail.go.th', 'investment.1@ieat.mail.go.th'];

const PROVINCE_EMAILS: Array<{ provinceName: string; emails: string[] }> = [
  { provinceName: 'กระบี่', emails: ['saraban_krabi@industry.go.th'] },
  { provinceName: 'กาญจนบุรี', emails: ['saraban_kanchanaburi@industry.go.th'] },
  { provinceName: 'กาฬสินธุ์', emails: ['saraban_kalasin@industry.go.th'] },
  { provinceName: 'กำแพงเพชร', emails: ['saraban_kamphaengphet@industry.go.th'] },
  { provinceName: 'ขอนแก่น', emails: ['saraban_khonkaen@industry.go.th'] },
  { provinceName: 'จันทบุรี', emails: ['saraban_chanthaburi@industry.go.th'] },
  { provinceName: 'ฉะเชิงเทรา', emails: ['saraban_chachoengsao@industry.go.th'] },
  { provinceName: 'ชลบุรี', emails: ['saraban_chonburi@industry.go.th'] },
  { provinceName: 'ชัยนาท', emails: ['moi_chainat@industry.go.th'] },
  { provinceName: 'ชัยภูมิ', emails: ['saraban_chaiyaphum@industry.go.th'] },
  { provinceName: 'ชุมพร', emails: ['saraban_chumphon@industry.go.th'] },
  { provinceName: 'เชียงราย', emails: ['saraban_chiangrai@industry.go.th'] },
  { provinceName: 'เชียงใหม่', emails: ['industry.cnx@gmail.com'] },
  { provinceName: 'ตรัง', emails: ['saraban_trang@industry.go.th'] },
  { provinceName: 'ตราด', emails: ['saraban_trat@industry.go.th'] },
  { provinceName: 'ตาก', emails: ['saraban_tak@industry.go.th'] },
  { provinceName: 'นครนายก', emails: ['saraban_nakhonnayok@industry.go.th'] },
  { provinceName: 'นครปฐม', emails: ['saraban_nakhonpathom@industry.go.th'] },
  { provinceName: 'นครพนม', emails: ['saraban_nakhonphanom@industry.go.th'] },
  { provinceName: 'นครราชสีมา', emails: ['Moi_nakhonratchasima@industry.go.th'] },
  { provinceName: 'นครศรีธรรมราช', emails: ['saraban_nakhonsithammarat@industry.go.th'] },
  { provinceName: 'นครสวรรค์', emails: ['saraban_nakhonsawan@industry.go.th'] },
  { provinceName: 'นนทบุรี', emails: ['saraban_nonthaburi@industry.go.th'] },
  { provinceName: 'นราธิวาส', emails: ['saraban_narathiwat@industry.go.th'] },
  { provinceName: 'น่าน', emails: ['saraban_nan@industry.go.th'] },
  { provinceName: 'บึงกาฬ', emails: ['saraban_buengkan@industry.go.th'] },
  { provinceName: 'บุรีรัมย์', emails: ['saraban_buriram@industry.go.th'] },
  { provinceName: 'ปทุมธานี', emails: ['saraban_pathumthani@industry.go.th'] },
  { provinceName: 'ประจวบคีรีขันธ์', emails: ['saraban_prachuapkhirikhan@industry.go.th'] },
  { provinceName: 'ปราจีนบุรี', emails: ['saraban_prachinburi@industry.go.th'] },
  { provinceName: 'ปัตตานี', emails: ['saraban_pattani@industry.go.th'] },
  { provinceName: 'พระนครศรีอยุธยา', emails: ['moi_ayutthaya@industry.go.th'] },
  { provinceName: 'พะเยา', emails: ['saraban_phayao@industry.go.th'] },
  { provinceName: 'พังงา', emails: ['saraban_phangnga@industry.go.th'] },
  { provinceName: 'พัทลุง', emails: ['saraban_phatthalung@industry.go.th'] },
  { provinceName: 'พิจิตร', emails: ['saraban_phichit@industry.go.th'] },
  { provinceName: 'พิษณุโลก', emails: ['saraban_phitsanulok@industry.go.th'] },
  { provinceName: 'เพชรบุรี', emails: ['saraban_phetchaburi@industry.go.th'] },
  { provinceName: 'เพชรบูรณ์', emails: ['saraban_phetchabun@industry.go.th'] },
  { provinceName: 'แพร่', emails: ['saraban_phrae@industry.go.th'] },
  { provinceName: 'ภูเก็ต', emails: ['saraban_phuket@industry.go.th'] },
  { provinceName: 'มหาสารคาม', emails: ['saraban_mahasarakham@industry.go.th'] },
  { provinceName: 'มุกดาหาร', emails: ['saraban_mukdahan@industry.go.th'] },
  { provinceName: 'แม่ฮ่องสอน', emails: ['saraban_maehongson@industry.go.th'] },
  { provinceName: 'ยะลา', emails: ['saraban_yala@industry.go.th'] },
  { provinceName: 'ยโสธร', emails: ['saraban_yasothon@industry.go.th'] },
  { provinceName: 'ระนอง', emails: ['saraban_ranong@industry.go.th'] },
  { provinceName: 'ระยอง', emails: ['saraban_rayong@industry.go.th'] },
  { provinceName: 'ราชบุรี', emails: ['saraban_ratchaburi@industry.go.th'] },
  { provinceName: 'ร้อยเอ็ด', emails: ['saraban_roiet@industry.go.th'] },
  { provinceName: 'ลพบุรี', emails: ['moi_lopburi@industry.go.th'] },
  { provinceName: 'ลำปาง', emails: ['saraban_lampang@industry.go.th'] },
  { provinceName: 'ลำพูน', emails: ['saraban_lamphun@industry.go.th'] },
  { provinceName: 'เลย', emails: ['saraban_loei@industry.go.th'] },
  { provinceName: 'ศรีสะเกษ', emails: ['saraban_sisaket@industry.go.th'] },
  { provinceName: 'สกลนคร', emails: ['saraban_sakonnakhon@industry.go.th'] },
  { provinceName: 'สงขลา', emails: ['saraban_songkhla@industry.go.th'] },
  { provinceName: 'สตูล', emails: ['saraban_satun@industry.go.th'] },
  { provinceName: 'สมุทรปราการ', emails: ['saraban_samutprakan@industry.go.th'] },
  { provinceName: 'สมุทรสงคราม', emails: ['Saraban_samutsongkhram@industry.go.th'] },
  { provinceName: 'สมุทรสาคร', emails: ['saraban_samutsakhon@industry.go.th'] },
  { provinceName: 'สระแก้ว', emails: ['saraban_sakaeo@industry.go.th'] },
  { provinceName: 'สระบุรี', emails: ['saraban_saraburi@industry.go.th'] },
  { provinceName: 'สิงห์บุรี', emails: ['saraban_singburi@industry.go.th'] },
  { provinceName: 'สุโขทัย', emails: ['saraban_sukhothai@industry.go.th'] },
  { provinceName: 'สุพรรณบุรี', emails: ['saraban_suphanburi@industry.go.th'] },
  { provinceName: 'สุราษฎร์ธานี', emails: ['saraban_suratthani@industry.go.th'] },
  { provinceName: 'สุรินทร์', emails: ['saraban_surin@industry.go.th'] },
  { provinceName: 'หนองคาย', emails: ['saraban_nongkhai@industry.go.th'] },
  { provinceName: 'หนองบัวลำภู', emails: ['saraban_nongbualamphu@industry.go.th'] },
  { provinceName: 'อ่างทอง', emails: ['saraban_angthong@industry.go.th'] },
  { provinceName: 'อำนาจเจริญ', emails: ['moi_amnatCharoen@industry.go.th'] },
  { provinceName: 'อุดรธานี', emails: ['saraban_udonthani@industry.go.th'] },
  { provinceName: 'อุตรดิตถ์', emails: ['saraban_uttaradit@industry.go.th'] },
  { provinceName: 'อุทัยธานี', emails: ['saraban_uthaithani@industry.go.th'] },
  { provinceName: 'อุบลราชธานี', emails: ['saraban_ubonratchathani@industry.go.th'] },
];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE_NAME, (table) => {
    table.bigIncrements('id').primary();
    table.specificType('recipient_type', 'VARCHAR(32) NOT NULL');
    table.specificType('province_name', 'NVARCHAR(128) NULL');
    table.specificType('emails_json', 'NVARCHAR(MAX) NOT NULL');
    table.boolean('is_active').notNullable().defaultTo(true);
    addAuditColumns(table);
  });

  await knex.schema.raw(`
    ALTER TABLE ${TABLE_NAME}
    ADD CONSTRAINT ck_officer_notification_email_recipients_type
    CHECK (recipient_type IN ('PROVINCE', 'INDUSTRIAL_ESTATE'));
  `);
  await knex.schema.raw(`
    CREATE UNIQUE INDEX uq_officer_notification_email_recipients_province
    ON ${TABLE_NAME}(recipient_type, province_name)
    WHERE deleted_at IS NULL AND recipient_type = 'PROVINCE';
  `);
  await knex.schema.raw(`
    CREATE UNIQUE INDEX uq_officer_notification_email_recipients_estate
    ON ${TABLE_NAME}(recipient_type)
    WHERE deleted_at IS NULL AND recipient_type = 'INDUSTRIAL_ESTATE';
  `);

  await knex(TABLE_NAME).insert([
    {
      recipient_type: 'INDUSTRIAL_ESTATE',
      province_name: null,
      emails_json: JSON.stringify(IEAT_EMAILS),
      created_by: null,
      updated_by: null,
    },
    ...PROVINCE_EMAILS.map((item) => ({
      recipient_type: 'PROVINCE',
      province_name: item.provinceName,
      emails_json: JSON.stringify(item.emails),
      created_by: null,
      updated_by: null,
    })),
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE_NAME);
}
