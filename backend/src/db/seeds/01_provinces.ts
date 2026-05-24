import type { Knex } from 'knex';

const PROVINCES = [
  { id: '1000', name_th: 'กรุงเทพมหานคร', name_en: 'Bangkok', region: 'ภาคกลาง' },
  { id: '1011', name_th: 'สมุทรปราการ', name_en: 'Samut Prakan', region: 'ภาคกลาง' },
  { id: '1012', name_th: 'นนทบุรี', name_en: 'Nonthaburi', region: 'ภาคกลาง' },
  { id: '1013', name_th: 'ปทุมธานี', name_en: 'Pathum Thani', region: 'ภาคกลาง' },
  { id: '1014', name_th: 'พระนครศรีอยุธยา', name_en: 'Phra Nakhon Si Ayutthaya', region: 'ภาคกลาง' },
  { id: '1019', name_th: 'สระบุรี', name_en: 'Saraburi', region: 'ภาคกลาง' },
  { id: '1020', name_th: 'ชลบุรี', name_en: 'Chon Buri', region: 'ภาคตะวันออก' },
  { id: '1021', name_th: 'ระยอง', name_en: 'Rayong', region: 'ภาคตะวันออก' },
  { id: '1024', name_th: 'ฉะเชิงเทรา', name_en: 'Chachoengsao', region: 'ภาคตะวันออก' },
  { id: '1070', name_th: 'ราชบุรี', name_en: 'Ratchaburi', region: 'ภาคตะวันตก' },
  { id: '1072', name_th: 'สุพรรณบุรี', name_en: 'Suphan Buri', region: 'ภาคกลาง' },
  { id: '1074', name_th: 'สมุทรสาคร', name_en: 'Samut Sakhon', region: 'ภาคกลาง' },
  { id: '1075', name_th: 'สมุทรสงคราม', name_en: 'Samut Songkhram', region: 'ภาคกลาง' },
  { id: '1090', name_th: 'สงขลา', name_en: 'Songkhla', region: 'ภาคใต้' },
  { id: '1050', name_th: 'เชียงใหม่', name_en: 'Chiang Mai', region: 'ภาคเหนือ' },
  { id: '1051', name_th: 'ลำพูน', name_en: 'Lamphun', region: 'ภาคเหนือ' },
  { id: '1030', name_th: 'นครราชสีมา', name_en: 'Nakhon Ratchasima', region: 'ภาคตะวันออกเฉียงเหนือ' },
  { id: '1040', name_th: 'ขอนแก่น', name_en: 'Khon Kaen', region: 'ภาคตะวันออกเฉียงเหนือ' },
];

export async function seed(knex: Knex): Promise<void> {
  for (const p of PROVINCES) {
    const exists = await knex('provinces').where({ id: p.id }).first('id');
    if (exists) {
      await knex('provinces').where({ id: p.id }).update({
        name_th: p.name_th,
        name_en: p.name_en,
        region: p.region,
      });
    } else {
      await knex('provinces').insert(p);
    }
  }
}
