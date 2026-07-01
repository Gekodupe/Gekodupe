window.currentExcelWorkbook = null;
window.currentExcelFilename = null;

function downloadCsvBlob(csvContent, filename) {
  var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename || 'deduplicated-output.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function loadExcelWorkbook(arrayBuffer, filename, callback) {
  if (typeof XLSX === 'undefined') {
    safeToast('SheetJS not loaded. Using text mode.', 'warning');
    return;
  }
  try {
    var workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    window.currentExcelWorkbook = workbook;
    window.currentExcelFilename = filename;
    var sheetName = workbook.SheetNames[0];
    if (callback) callback(XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]));
  } catch (e) {
    console.error('Excel read error:', e);
    safeToast('Could not parse workbook: ' + e.message, 'error');
  }
}

function processExcel(txt, doStack, doCaps, doBlanks, sortOrder, simThreshold, filterMode, ignorePunct, collapseWs) {
  return processCsv(txt, doStack, doCaps, doBlanks, sortOrder, simThreshold, filterMode, ignorePunct, collapseWs);
}

function excelBufferToCsv(arrayBuffer) {
  if (typeof XLSX === 'undefined') return null;
  var workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  var sheetName = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
}

function csvToExcelBuffer(csvContent, sheetName) {
  if (typeof XLSX === 'undefined') return null;
  var worksheet = XLSX.utils.csv_to_sheet(csvContent);
  var workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, (sheetName || 'Sheet1').substring(0, 31));
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
}

function downloadExcelWorkbook(csvContent, defaultFilename) {
  if (typeof XLSX === 'undefined') {
    downloadCsvBlob(csvContent, defaultFilename);
    safeToast('Downloaded as CSV (SheetJS not found)', 'warning');
    return;
  }

  try {
    var worksheet = XLSX.utils.csv_to_sheet(csvContent);
    var workbook = XLSX.utils.book_new();
    var sheetName = window.currentExcelWorkbook && window.currentExcelWorkbook.SheetNames[0]
      ? window.currentExcelWorkbook.SheetNames[0]
      : 'Deduplicated';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));
    var outFilename = window.currentExcelFilename
      ? window.currentExcelFilename.replace(/\.[^/.]+$/, '') + '-deduplicated.xlsx'
      : 'deduplicated-output.xlsx';
    XLSX.writeFile(workbook, outFilename);
  } catch (e) {
    console.error('Excel write error:', e);
    safeToast('Excel export failed. Downloading CSV.', 'warning');
    downloadCsvBlob(csvContent, 'deduplicated-output.csv');
  }
}
