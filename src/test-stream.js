import fs from "node:fs";

const stream = fs.createReadStream(
  "./data/customer_mock_1000000_extended.csv",
  { encoding: "utf8" }
);

for await (const chunk of stream) {
  console.log(chunk);
  break;
}