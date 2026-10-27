import assert from "node:assert/strict";
import test from "node:test";
import { detectMapping, hourOf, numberOf, readSheet, salesStats, statsText } from "../server/sales.mjs";
import * as XLSX from "xlsx";

const book = (rows) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Doanh thu");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
};

test("sales: numbers and hours as Vietnamese shops write them", () => {
  assert.equal(numberOf("780.000"), 780000);
  assert.equal(numberOf("780,000đ"), 780000);
  assert.equal(numberOf(12), 12);
  assert.equal(numberOf("hết"), null);
  assert.equal(hourOf("11:30"), 11);
  assert.equal(hourOf("2026-10-22 18:05:00"), 18);
  assert.equal(hourOf("14h"), 14);
  assert.equal(hourOf(0.5), 12); // Excel stores 12:00 as 0.5
});

test("sales: the header row is found below a title, and columns are guessed", () => {
  const f = readSheet(book([["Báo cáo bán hàng tháng 10"], [], ["Tên món", "Số lượng", "Thành tiền", "Giờ"], ["Phở bò", 4, 260000, "11:30"]]));
  assert.deepEqual(f.headers, ["Tên món", "Số lượng", "Thành tiền", "Giờ"]);
  assert.deepEqual(detectMapping(f.headers), { dish: 0, qty: 1, amount: 2, time: 3 });
});

test("sales: totals, best and slow sellers, busy and quiet hours are counted from the rows", () => {
  const rows = [
    ["Phở bò", 3, 195000, "11:00"],
    ["Phở bò", 2, 130000, "18:00"],
    ["Trà đá", 10, 50000, "18:00"],
    ["Bún chả", 1, 45000, "12:00"],
    ["Nem rán", 2, 70000, "12:00"],
    ["Chả giò", 1, 30000, "12:00"],
    ["Nước sấu", 1, 15000, "14:00"],
    ["", 5, 1, "14:00"], // no dish name: skipped
  ];
  const s = salesStats(rows, { dish: 0, qty: 1, amount: 2, time: 3 });
  assert.equal(s.totalQty, 20);
  assert.equal(s.totalAmount, 535000);
  assert.equal(s.dishCount, 6);
  assert.equal(s.skipped, 1);
  assert.equal(s.topDishes[0].name, "Trà đá");
  assert.equal(s.topDishes[0].qty, 10);
  assert.equal(s.topDishes[1].name, "Phở bò");
  assert.equal(s.topDishes[1].qty, 5);
  assert.equal(s.peakHours[0].hour, 18);
  assert.equal(s.peakHours[0].qty, 12);
  assert.deepEqual(s.quietHours, []); // fewer than 6 different hours: no quiet-hour claim
  assert.match(statsText(s), /Doanh thu: 535\.000đ/);
});

test("sales: a file with no dish column, or no sales rows, is refused with a reason", () => {
  assert.throws(() => salesStats([["a", 1]], {}), /tên món/);
  assert.throws(() => salesStats([["", 0, 0]], { dish: 0, qty: 1 }), /Không đọc được dòng bán/);
  assert.throws(() => readSheet(book([["chỉ một cột"]])), /tiêu đề/);
});

test("sales: US POS headers (Toast, Square) find the money column", () => {
  assert.deepEqual(detectMapping(["Date", "Time", "Item", "Qty", "Net Sales"]), { dish: 2, qty: 3, amount: 4, time: 1, date: 0 });
  assert.deepEqual(detectMapping(["Menu Item", "Item Qty", "Gross Sales"]), { dish: 0, qty: 1, amount: 2 });
});
