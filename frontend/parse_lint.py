import json

with open('lint_report.json', 'r', encoding='utf-16') as f:
    report = json.load(f)

for file_info in report:
    if file_info['errorCount'] > 0:
        print(f"{file_info['filePath']}: {file_info['errorCount']} errors")
