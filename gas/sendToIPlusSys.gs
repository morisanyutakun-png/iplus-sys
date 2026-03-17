/**
 * iPlus Sys 印刷キュー自動化 — GAS側送信スクリプト
 *
 * sendClassroom() の末尾（反映完了の直前）に以下を追加:
 *   sendToIPlusSys(seitoID, r0, w0, printR, printW);
 *
 * 設定: IPLUS_API_URL を自分の環境のバックエンドURLに変更してください。
 */

var IPLUS_API_URL = "http://localhost:8000"; // ← 実際のバックエンドURLに変更

/**
 * テスト結果をiPlus Sysに送信し、印刷キューに自動追加する
 * @param {string} seitoID - 生徒のClassroom ID
 * @param {Array} r0 - テスト結果の配列 [[教科名 ▶️, 結果文字列], ...]
 * @param {Array} w0 - 次回課題の配列 [[教科名 ▶️, 範囲, ...], ...]
 * @param {boolean} printR - テスト結果を印刷するか
 * @param {boolean} printW - 課題を印刷するか
 */
function sendToIPlusSys(seitoID, r0, w0, printR, printW) {
  // テスト結果から合否情報を構造化
  var results = [];
  for (var i = 0; i < r0.length; i++) {
    var subjectRaw = r0[i][0]; // "w:英単語1900 ▶️"
    var resultText = r0[i][1]; // "501-600 80/100 合格"

    // 教科名から "▶️" を除去
    var subject = subjectRaw.replace(/\s*▶️\s*$/, '').trim();

    // 合否判定
    var passed = null; // null = 未実施
    if (resultText.indexOf('合格') !== -1 && resultText.indexOf('不合格') === -1) {
      passed = true;
    } else if (resultText.indexOf('不合格') !== -1) {
      passed = false;
    } else if (resultText.indexOf('未実施') !== -1) {
      passed = null;
    } else if (resultText.indexOf('自己採点') !== -1) {
      // 自己採点は合格扱い（ポインタを進める）
      passed = true;
    }

    // 範囲の抽出（◆で区切られている場合は最初の範囲）
    var rangeParts = resultText.split('◆');
    var range = rangeParts[0].trim().split(/\s+/)[0] || '';

    results.push({
      subject: subject,
      range: range,
      pass: passed
    });
  }

  // 次回課題の構造化
  var works = [];
  for (var j = 0; j < w0.length; j++) {
    var workSubject = w0[j][0].replace(/\s*▶️\s*$/, '').trim();
    var workDetail = w0[j][1] || '';
    works.push({
      title: workSubject,
      detail: workDetail
    });
  }

  var payload = {
    seitoID: seitoID,
    results: results,
    works: works,
    printR: printR,
    printW: printW,
    status: '反映済み',
    today: {
      month: new Date().getMonth() + 1,
      day: new Date().getDate()
    }
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(IPLUS_API_URL + '/api/gas/webhook', options);
    var responseCode = response.getResponseCode();
    if (responseCode === 200) {
      Logger.log('iPlus Sys: 送信成功 - ' + response.getContentText());
    } else {
      Logger.log('iPlus Sys: 送信エラー (' + responseCode + ') - ' + response.getContentText());
    }
  } catch (e) {
    Logger.log('iPlus Sys: 通信エラー - ' + e.message);
  }
}
