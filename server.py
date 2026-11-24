import os
import io
import json
from flask import Flask, request, send_file, jsonify, send_from_directory
from flask_cors import CORS
from excel_generator import create_voucher_workbook

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, 'public') if os.path.exists(os.path.join(BASE_DIR, 'public')) else os.path.join(BASE_DIR, 'static')

app = Flask(__name__, static_folder=STATIC_DIR)
CORS(app)

@app.route('/')
def index():
    return send_from_directory(STATIC_DIR, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    if os.path.exists(os.path.join(STATIC_DIR, path)):
        return send_from_directory(STATIC_DIR, path)
    return send_from_directory(BASE_DIR, path)

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'app': 'CFR Travel Voucher Assistant'})

@app.route('/api/sample', methods=['GET'])
def get_sample_data():
    sample_file = os.path.join(BASE_DIR, 'sample_data.json')
    if os.path.exists(sample_file):
        with open(sample_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    return jsonify({'error': 'Sample file not found'}), 404

@app.route('/api/export', methods=['POST'])
def export_excel():
    try:
        data = request.get_json(force=True)
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        wb = create_voucher_workbook(data)
        
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

        emp = str(data.get('employeeName', 'Employee')).replace(' ', '_')
        month = str(data.get('monthOfExpenses', 'Expenses')).replace('-', '_')
        filename = f"Travel_Voucher_{emp}_{month}.xlsx"

        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"🚀 CFR Travel Voucher Assistant running on http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
