import { read, SSF, utils } from 'xlsx';
import { maxImportedExpenses, uid, validateImportedExpense, type ImportedExpense } from './model';

const maxRows = maxImportedExpenses + 25;
const maxFileBytes = 8_000_000;

function cellText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

function expenseDate(value: unknown, date1904: boolean): string {
  if (typeof value === 'number') {
    const date = SSF.parse_date_code(value, { date1904 });
    return date ? `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}` : '';
  }
  const match = /^(\d{4})[.\/-]\s*(\d{1,2})[.\/-]\s*(\d{1,2})\.?\s*(?:\([^)]*\))?$/.exec(cellText(value));
  return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : '';
}

function expenseTime(value: unknown): string {
  if (typeof value === 'number' && value >= 0 && value < 1) {
    const minutes = Math.floor(value * 1440 + 1e-8);
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }
  const text = cellText(value);
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : text;
}

function expenseAmount(value: unknown): number {
  if (typeof value === 'number') return value;
  const text = cellText(value).replace(/^₩\s*|\s*원$/g, '');
  return /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.0+)?$/.test(text) ? Number(text.replaceAll(',', '')) : NaN;
}

export async function readExpenseWorkbook(file: File): Promise<{ rows: ImportedExpense[]; invalid: number }> {
  if (!/\.xlsx?$/i.test(file.name)) throw new Error('.xls 또는 .xlsx 파일을 선택해 주세요.');
  if (file.size > maxFileBytes) throw new Error('8MB 이하의 엑셀 파일을 선택해 주세요.');

  let workbook;
  try {
    workbook = read(await file.arrayBuffer(), { type: 'array', cellFormula: false, cellHTML: false, sheetRows: maxRows });
  } catch {
    throw new Error('엑셀 파일을 읽을 수 없어요.');
  }

  const records: ImportedExpense[] = [];
  let invalid = 0;
  let foundExpenseSheet = false;
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet?.['!ref']) continue;
    const bounds = utils.decode_range(sheet['!ref']);
    const rows = utils.sheet_to_json<unknown[]>(sheet, {
      header: 1, defval: null, blankrows: false, raw: true,
      range: { s: bounds.s, e: { r: Math.min(bounds.e.r, maxRows - 1), c: Math.min(bounds.e.c, bounds.s.c + 31) } },
    });
    const normalize = (row: unknown[]) => row.map(value => cellText(value).replace(/\s+|\(원\)/g, ''));
    const header = rows.slice(0, 25).findIndex(row => {
      const keys = normalize(row);
      return ['지출일', '지출내역', '지출금액', '카테고리'].every(label => keys.includes(label));
    });
    if (header < 0) continue;
    foundExpenseSheet = true;
    if (utils.decode_range(sheet['!fullref'] ?? sheet['!ref']).e.r >= maxRows) throw new Error('한 번에 지출 10,000건까지 가져올 수 있어요.');

    const fields = normalize(rows[header]);
    const dateColumn = fields.indexOf('지출일');
    const timeColumn = fields.indexOf('지출시간');
    const nameColumn = fields.indexOf('지출내역');
    const amountColumn = fields.indexOf('지출금액');
    const categoryColumn = fields.indexOf('카테고리');
    const subcategoryColumn = fields.indexOf('세부카테고리');
    for (const row of rows.slice(header + 1)) {
      if (records.length + invalid >= maxImportedExpenses) throw new Error('한 번에 지출 10,000건까지 가져올 수 있어요.');
      try {
        records.push(validateImportedExpense({
          id: uid(),
          date: expenseDate(row[dateColumn], Boolean(workbook.Workbook?.WBProps?.date1904)),
          time: expenseTime(row[timeColumn]),
          name: cellText(row[nameColumn]),
          category: cellText(row[categoryColumn]) || '미분류',
          subcategory: cellText(row[subcategoryColumn]),
          amount: expenseAmount(row[amountColumn]),
        }));
      } catch {
        invalid++;
      }
    }
  }
  if (!foundExpenseSheet) throw new Error('똑똑가계부 지출 내역의 열을 찾지 못했어요.');
  return { rows: records, invalid };
}
