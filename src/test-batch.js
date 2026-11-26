import fs from "node:fs";
import { parse } from "csv-parse";
import sequelize from "./database.js";
import Customer from "./models/customer.js";

const BATCH_SIZE = 10;
const LIMIT = 25;

let batch = [];
let readCount = 0;
let importedCount = 0;

try {
  await sequelize.authenticate();

  await Customer.destroy({
    truncate: true,
    restartIdentity: true
  });

  const stream = fs.createReadStream(
    "./data/customer_mock_1000000_extended.csv"
  );

  const parser = stream.pipe(parse({
    columns: true,
    skip_empty_lines: true,
    bom: true
  }));

  stream.on("error", error => parser.destroy(error));

  try {
    for await (const record of parser) {
      batch.push(record);
      readCount++;

      if (batch.length === BATCH_SIZE) {
        await Customer.bulkCreate(batch, {
          returning: false
        });

        importedCount += batch.length;

        console.log("Imported batch:", batch.length);

        batch = [];
      }

      if (readCount === LIMIT) {
        break;
      }
    }

    if (batch.length > 0) {
      await Customer.bulkCreate(batch, {
        returning: false
      });

      importedCount += batch.length;

      console.log("Imported remaining:", batch.length);

      batch = [];
    }
  } finally {
    stream.destroy();
    parser.destroy();
  }

  console.log("Total read:", readCount);
  console.log("Total imported:", importedCount);
  console.log("Database count:", await Customer.count());

} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}