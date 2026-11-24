import copy
import os
from datetime import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

REFERENCE_TEMPLATE_PATH = os.path.join(
    os.path.dirname(__file__), 
    'reference', 
    '09-10-2026 & 10-10-2026--Travel voucher.xlsx'
)

def create_voucher_workbook(data, template_path=None):
    """
    Creates an Excel workbook (.xlsx) matching the exact company travel voucher layout.
    Preserves all styling, fonts, borders, fills, merged cells, and signature blocks.
    """
    if template_path is None:
        template_path = REFERENCE_TEMPLATE_PATH

    template_wb = openpyxl.load_workbook(template_path)
    base_ws = template_wb['09-10-2026']

    # New target workbook
    out_wb = openpyxl.Workbook()
    # Remove default sheet
    default_sheet = out_wb.active

    days = data.get('days', [])
    if not days:
        days = [{
            'date': datetime.now().strftime('%d-%m-%Y'),
            'sheetName': datetime.now().strftime('%d-%m-%Y'),
            'advances': 0,
            'legs': []
        }]

    employee_name = data.get('employeeName', 'Sai Krishna Meesala')
    reporting_manager = data.get('reportingManager', 'Kedar Narvekar')
    default_customer = data.get('customerName', 'NOVAMESH, COFORGE')
    month_str = data.get('monthOfExpenses', '2026-10-10')

    # Parse month date
    try:
        if '-' in month_str:
            parts = [int(p) for p in month_str.split('-')]
            if parts[0] > 1000:
                month_dt = datetime(parts[0], parts[1], parts[2] if len(parts) > 2 else 1)
            else:
                month_dt = datetime(parts[2], parts[1], parts[0])
        else:
            month_dt = datetime.now()
    except Exception:
        month_dt = datetime.now()

    for day_idx, day_info in enumerate(days):
        sheet_title = day_info.get('sheetName') or day_info.get('date', f'Day {day_idx + 1}')
        # Sanitize sheet title (max 31 chars, no invalid chars)
        sheet_title = str(sheet_title).replace('/', '-').replace('\\', '-').replace(':', '-')[:31]
        
        ws = out_wb.create_sheet(title=sheet_title)

        # 1. Copy column dimensions
        for col_letter, dim in base_ws.column_dimensions.items():
            if dim.width:
                ws.column_dimensions[col_letter].width = dim.width

        # 2. Setup Top Header block (Rows 1 to 8)
        for r in range(1, 9):
            if base_ws.row_dimensions[r].height:
                ws.row_dimensions[r].height = base_ws.row_dimensions[r].height
            for c in range(1, 26):
                src_cell = base_ws.cell(r, c)
                dst_cell = ws.cell(r, c)
                
                # Copy styling
                if src_cell.has_style:
                    dst_cell.font = copy.copy(src_cell.font)
                    dst_cell.border = copy.copy(src_cell.border)
                    dst_cell.fill = copy.copy(src_cell.fill)
                    dst_cell.number_format = src_cell.number_format
                    dst_cell.alignment = copy.copy(src_cell.alignment)
                
                dst_cell.value = src_cell.value

        # Fill dynamic top metadata
        ws.cell(3, 5).value = employee_name   # E3
        ws.cell(4, 5).value = reporting_manager # E4
        ws.cell(5, 5).value = month_dt        # E5
        ws.cell(5, 5).number_format = 'mmm-yy'

        # Parse day date
        day_date_val = day_info.get('date', '')
        try:
            if '-' in str(day_date_val):
                p = [int(x) for x in str(day_date_val).split('-')]
                if p[0] > 1000:
                    day_dt = datetime(p[0], p[1], p[2])
                else:
                    day_dt = datetime(p[2], p[1], p[0])
            else:
                day_dt = datetime.now()
        except Exception:
            day_dt = datetime.now()

        # Re-apply top header merges
        top_merges = [
            'C2:G2', 'C3:D3', 'E3:G3', 'C4:D4', 'E4:G4', 'C5:D5', 'E5:G5',
            'B7:B8', 'C7:C8', 'D7:D8', 'E7:E8', 'F7:F8', 'G7:H7', 'I7:I8',
            'J7:J8', 'K7:Q7', 'R7:T8', 'U7:U8'
        ]
        for rng in top_merges:
            try:
                ws.merge_cells(rng)
            except Exception:
                pass

        # 3. Insert Data Rows (starting from Row 9)
        legs = day_info.get('legs', [])
        num_legs = len(legs)
        curr_row = 9

        # Reference row 9 styles for data cells
        sample_styles = {}
        for c in range(1, 26):
            cell = base_ws.cell(9, c)
            sample_styles[c] = {
                'font': copy.copy(cell.font),
                'border': copy.copy(cell.border),
                'fill': copy.copy(cell.fill),
                'alignment': copy.copy(cell.alignment),
                'number_format': cell.number_format
            }

        daily_subtotal = 0

        for idx, leg in enumerate(legs, 1):
            r = curr_row
            ws.row_dimensions[r].height = 20

            # Default style all columns B to U
            for c in range(2, 22):
                cell = ws.cell(r, c)
                s = sample_styles.get(c, sample_styles[2])
                cell.font = copy.copy(s['font'])
                cell.border = copy.copy(s['border'])
                cell.fill = copy.copy(s['fill'])
                cell.alignment = copy.copy(s['alignment'])

            # Merge R:T for food/hamali/others column
            ws.merge_cells(start_row=r, start_column=18, end_row=r, end_column=20)

            # Col B: Sr. No
            ws.cell(r, 2).value = idx
            # Col C: Date
            ws.cell(r, 3).value = day_dt
            ws.cell(r, 3).number_format = '[$-409]d/mmm/yy'
            # Col D: Customer Name
            ws.cell(r, 4).value = leg.get('customer') or default_customer
            # Col E: From
            ws.cell(r, 5).value = leg.get('from', '')
            # Col F: To
            ws.cell(r, 6).value = leg.get('to', '')

            # Travel Details
            mode = str(leg.get('mode', '')).lower().strip()
            amount = float(leg.get('amount', 0) or 0)
            km = leg.get('km', '')
            purpose = leg.get('purpose', '')

            # Col I: Purpose
            ws.cell(r, 9).value = purpose

            if mode in ['bike', 'motorcycle']:
                ws.cell(r, 7).value = 'Bike' # Col G
                if km:
                    try:
                        ws.cell(r, 8).value = float(km) # Col H
                    except ValueError:
                        ws.cell(r, 8).value = km
                ws.cell(r, 15).value = amount # Col O (Bike)
            elif mode == 'car':
                ws.cell(r, 7).value = 'Car' # Col G
                if km:
                    try:
                        ws.cell(r, 8).value = float(km) # Col H
                    except ValueError:
                        ws.cell(r, 8).value = km
                ws.cell(r, 16).value = amount # Col P (Car)
            elif mode == 'flight':
                ws.cell(r, 11).value = amount # Col K (Flight)
            elif mode == 'bus':
                ws.cell(r, 12).value = amount # Col L (Bus)
            elif mode == 'auto':
                ws.cell(r, 13).value = amount # Col M (Auto)
            elif mode == 'taxi':
                ws.cell(r, 14).value = amount # Col N (Taxi)
            elif mode == 'train':
                ws.cell(r, 17).value = amount # Col Q (Train)
            elif mode in ['food', 'hamali', 'porter', 'other', 'others']:
                ws.cell(r, 18).value = amount # Col R:T (Food/Hamali/Others)
            elif mode == 'lodging':
                ws.cell(r, 10).value = amount # Col J (Lodging)
            else:
                # Default to transportation col O or R
                ws.cell(r, 18).value = amount

            # Col U: Total
            ws.cell(r, 21).value = amount
            daily_subtotal += amount

            curr_row += 1

        # Spacer row
        spacer_row = curr_row
        curr_row += 1

        # 4. Footer Calculations Block
        # Helper for solid fill on totals
        total_fill = PatternFill(start_color="D9D9D9", end_color="D9D9D9", fill_type="solid")
        bold_font = Font(name="Calibri", size=11, bold=True)
        regular_font = Font(name="Calibri", size=11, bold=False)
        center_align = Alignment(horizontal="center", vertical="center")
        thin_border = Border(
            left=Side(style='thin', color='A0A0A0'),
            right=Side(style='thin', color='A0A0A0'),
            top=Side(style='thin', color='A0A0A0'),
            bottom=Side(style='thin', color='A0A0A0')
        )

        # Row 1: Subtotal sum indicator
        ws.cell(curr_row, 21).value = daily_subtotal
        ws.cell(curr_row, 21).fill = total_fill
        ws.cell(curr_row, 21).alignment = center_align
        ws.cell(curr_row, 21).font = bold_font
        curr_row += 2

        # Row: SUBTOTAL
        subtotal_row = curr_row
        ws.cell(subtotal_row, 17).value = "SUBTOTAL"
        ws.cell(subtotal_row, 17).font = bold_font
        ws.merge_cells(start_row=subtotal_row, start_column=17, end_row=subtotal_row, end_column=20)
        ws.cell(subtotal_row, 21).value = daily_subtotal
        ws.cell(subtotal_row, 21).fill = total_fill
        ws.cell(subtotal_row, 21).font = bold_font
        ws.cell(subtotal_row, 21).alignment = center_align
        ws.cell(subtotal_row, 21).border = thin_border
        curr_row += 1

        # Row: ADVANCES
        advances_val = float(day_info.get('advances', 0) or 0)
        advances_row = curr_row
        ws.cell(advances_row, 17).value = "ADVANCES"
        ws.cell(advances_row, 17).font = bold_font
        ws.merge_cells(start_row=advances_row, start_column=17, end_row=advances_row, end_column=20)
        ws.cell(advances_row, 21).value = advances_val
        ws.cell(advances_row, 21).fill = total_fill
        ws.cell(advances_row, 21).alignment = center_align
        ws.cell(advances_row, 21).border = thin_border
        curr_row += 1

        # Row: TOTAL REIMBURSEMENT
        reimbursement_val = daily_subtotal - advances_val
        reimbursement_row = curr_row
        ws.cell(reimbursement_row, 17).value = "TOTAL REIMBURSEMENT"
        ws.cell(reimbursement_row, 17).font = bold_font
        ws.merge_cells(start_row=reimbursement_row, start_column=17, end_row=reimbursement_row, end_column=20)
        ws.cell(reimbursement_row, 21).value = reimbursement_val
        ws.cell(reimbursement_row, 21).fill = total_fill
        ws.cell(reimbursement_row, 21).font = bold_font
        ws.cell(reimbursement_row, 21).alignment = center_align
        ws.cell(reimbursement_row, 21).border = thin_border
        curr_row += 1

        # Row: Don't forget to attach receipts
        receipt_row = curr_row
        ws.cell(receipt_row, 17).value = "* Don't forget to attach receipts *"
        ws.cell(receipt_row, 17).font = Font(name="Calibri", size=10, bold=True, italic=True)
        ws.merge_cells(start_row=receipt_row, start_column=17, end_row=receipt_row, end_column=21)
        curr_row += 3

        # Signatures block
        sig1_row = curr_row
        ws.cell(sig1_row, 3).value = "Re Checked By"
        ws.cell(sig1_row, 3).font = bold_font
        ws.merge_cells(start_row=sig1_row, start_column=3, end_row=sig1_row, end_column=10)

        ws.cell(sig1_row, 11).value = "Date"
        ws.cell(sig1_row, 17).value = "Authorized By"
        ws.cell(sig1_row, 17).font = bold_font
        ws.merge_cells(start_row=sig1_row, start_column=17, end_row=sig1_row, end_column=20)

        ws.cell(sig1_row, 21).value = "Date"
        ws.cell(sig1_row, 21).font = bold_font
        curr_row += 3

        # Finance & Office Use Only block
        box1_row = curr_row
        ws.cell(box1_row, 3).value = "Finance"
        ws.cell(box1_row, 3).font = bold_font
        ws.cell(box1_row, 3).fill = total_fill
        ws.merge_cells(start_row=box1_row, start_column=3, end_row=box1_row + 3, end_column=12)

        ws.cell(box1_row, 17).value = "For Office Use Only "
        ws.cell(box1_row, 17).fill = total_fill
        ws.merge_cells(start_row=box1_row, start_column=17, end_row=box1_row + 3, end_column=21)
        curr_row += 6

        # Final Approval Block
        sig2_row = curr_row
        ws.cell(sig2_row, 17).value = "Final Approval By"
        ws.cell(sig2_row, 17).font = bold_font
        ws.merge_cells(start_row=sig2_row, start_column=17, end_row=sig2_row, end_column=20)
        ws.cell(sig2_row, 21).value = "Date"
        curr_row += 3

        box2_row = curr_row
        ws.cell(box2_row, 17).value = "For Office Use Only "
        ws.cell(box2_row, 17).fill = total_fill
        ws.merge_cells(start_row=box2_row, start_column=17, end_row=box2_row + 3, end_column=21)

    # Remove the initial default empty sheet
    out_wb.remove(default_sheet)
    return out_wb
