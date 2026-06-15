import assert from "node:assert/strict";
import { parseTdnetHtml } from "../src/worker.js";

const html = `
<table id="main-list-table">
<tr>
<td class="oddnew-L kjTime" noWrap>15:30</td>
<td class="oddnew-M kjCode" noWrap>72030</td>
<td class="oddnew-M kjName" noWrap>トヨタ自動車                  </td>
<td class="oddnew-M kjTitle" align="left"><a href="140120260615000001.pdf" target="_blank">2026年3月期 決算短信〔IFRS〕（連結）</a></td>
<td class="oddnew-M kjXbrl"></td>
</tr>
<tr>
<td class="evennew-L kjTime" noWrap>16:00</td>
<td class="evennew-M kjCode" noWrap>241A0</td>
<td class="evennew-M kjName" noWrap>Ｇ－テスト</td>
<td class="evennew-M kjTitle" align="left"><a href="140120260615000002.pdf" target="_blank">通期業績予想の修正に関するお知らせ</a></td>
<td class="evennew-M kjXbrl"></td>
</tr>
</table>
`;

const rows = parseTdnetHtml(html, "2026-06-15");

assert.equal(rows.length, 2);
assert.equal(rows[0].code, "7203");
assert.equal(rows[0].company, "トヨタ自動車");
assert.equal(rows[0].category, "決算");
assert.equal(rows[0].url, "https://www.release.tdnet.info/inbs/140120260615000001.pdf");
assert.equal(rows[1].code, "241A");
assert.equal(rows[1].category, "業績修正");
assert.equal(rows[1].priority, "high");

console.log("tdnet parser ok");
