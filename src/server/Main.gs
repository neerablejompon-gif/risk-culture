/**
 * Web App entry. Routing ทำฝั่ง client (?page=dashboard|activities|report|mytasks|inbox|guidelines)
 */
function doGet() {
  return HtmlService.createTemplateFromFile('client/Index')
    .evaluate()
    .setTitle('Risk Culture Tracker · กยท.')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/** รวมไฟล์ HTML ของระบบเอง (ไม่ใช่ข้อมูลผู้ใช้) */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}
