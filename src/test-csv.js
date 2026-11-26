import fs from "node:fs";
import { parse } from "csv-parse";

const parser = fs
  .createReadStream("./data/customer_mock_1000000_extended.csv")
  .pipe(parse({
    columns: true,
    skip_empty_lines: true,
    bom: true
  }));

let count = 0;

for await (const record of parser) {
  count++;

  if (count % 100000 === 0) {
    console.log("Read records:", count);
  }
}

console.log("Total records:", count);