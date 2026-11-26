import fs from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { parse } from "csv-parse";
import { performance } from "node:perf_hooks";
import sequelize from "./database.js";
import Customer from "./models/customer.js";

const TOTAL_RECORDS = 1000000;
const BATCH_SIZE = Number(process.argv[2]);
const LIMIT = Number(process.argv[3] ?? Infinity);

const CSV_PATH =
  process.env.CSV_PATH ??
  "./data/customer_mock_1000000_extended.csv";

const expectedRecords = Math.min(TOTAL_RECORDS, LIMIT);

if (
  !Number.isSafeInteger(BATCH_SIZE) ||
  BATCH_SIZE <= 0 ||
  BATCH_SIZE > 10000
) {
  console.error("Invalid batch size");
  process.exit(1);
}

if (
  process.argv[3] !== undefined &&
  (!Number.isSafeInteger(LIMIT) || LIMIT <= 0)
) {
  console.error("Invalid record limit");
  process.exit(1);
}

const getMemoryMB = () => {
  return process.memoryUsage.rss() / 1024 / 1024;
};

let batch = [];
let readCount = 0;
let importedCount = 0;
let failedCount = 0;
let peakMemory = 0;
let lastProgressTime = 0;
let memoryTimer;
let fatalError = null;

function showProgress(force = false) {
  const now = performance.now();

  if (!force && now - lastProgressTime < 1000) {
    return;
  }

  const processed = importedCount + failedCount;
  const percent = (processed / expectedRecords) * 100;

  console.log(
    `Progress: ${percent.toFixed(2)}% | ` +
    `${processed}/${expectedRecords} | ` +
    `Imported: ${importedCount} | ` +
    `Failed: ${failedCount} | ` +
    `RAM: ${getMemoryMB().toFixed(2)} MB`
  );

  lastProgressTime = now;
}

async function insertBatch() {
  if (batch.length === 0) {
    return;
  }

  try {
    await Customer.bulkCreate(batch, {
      returning: false
    });

    importedCount += batch.length;
  } catch (error) {
    const code =
      error.parent?.code ??
      error.original?.code ??
      "";

    if (
      code.startsWith("22") ||
      code.startsWith("23")
    ) {
      failedCount += batch.length;
    } else {
      throw error;
    }
  }

  batch = [];
  showProgress();
}

try {
  await sequelize.authenticate();

  if (process.env.DB_NAME !== "csv_performance") {
    throw new Error("Unexpected database");
  }

  await Customer.destroy({
    truncate: true,
    restartIdentity: true
  });

  console.log("Starting CSV import...");
  console.log("Batch size:", BATCH_SIZE);
  console.log("Expected records:", expectedRecords);

  const memoryBefore = getMemoryMB();
  peakMemory = memoryBefore;

  const startTime = new Date();
  const start = performance.now();

  lastProgressTime = start;

  memoryTimer = setInterval(() => {
    peakMemory = Math.max(
      peakMemory,
      getMemoryMB()
    );
  }, 100);

  const stream = fs.createReadStream(CSV_PATH);

  const parser = stream.pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      bom: true
    })
  );

  stream.on("error", error => parser.destroy(error));

  try {
    for await (const record of parser) {
      batch.push(record);
      readCount++;

      if (batch.length === BATCH_SIZE) {
        await insertBatch();
      }

      if (readCount === LIMIT) {
        break;
      }
    }

    await insertBatch();

  } catch (error) {
    fatalError = error.name;
    console.error("Import interrupted:", error.name);
  } finally {
    stream.destroy();
    parser.destroy();
  }

  const end = performance.now();
  const endTime = new Date();
  const memoryAfter = getMemoryMB();

  clearInterval(memoryTimer);

  peakMemory = Math.max(
    peakMemory,
    memoryAfter
  );

  const executionTime = (end - start) / 1000;

  const recordsPerSecond =
    executionTime > 0
      ? importedCount / executionTime
      : 0;

  showProgress(true);

  let databaseCount = null;

  try {
    databaseCount = await Customer.count();
  } catch (error) {
    fatalError ??= error.name;
  }

  const verified =
    fatalError === null &&
    readCount === expectedRecords &&
    importedCount + failedCount === readCount &&
    databaseCount === importedCount;

  const status = !verified
    ? "incomplete"
    : failedCount > 0
      ? "completed_with_errors"
      : "completed";

  const report = {
    status,
    batch_size: BATCH_SIZE,
    total_records: readCount,
    imported_records: importedCount,
    failed_records: failedCount,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    execution_time: Number(executionTime.toFixed(4)),
    memory_before_mb: Number(memoryBefore.toFixed(2)),
    memory_after_mb: Number(memoryAfter.toFixed(2)),
    peak_memory_mb: Number(peakMemory.toFixed(2)),
    records_per_second: Number(recordsPerSecond.toFixed(2)),
    database_count: databaseCount,
    expected_records: expectedRecords,
    unconfirmed_records:
      readCount - importedCount - failedCount,
    verified,
    error: fatalError
  };

  console.table(report);

  await mkdir("./logs", {
    recursive: true
  });

  const timestamp = startTime
    .toISOString()
    .replace(/[:.]/g, "-");

  const logPath =
    `./logs/batch_${BATCH_SIZE}_${timestamp}.json`;

  await writeFile(
    logPath,
    JSON.stringify(report, null, 2)
  );

  console.log("Log saved:", logPath);

  if (status !== "completed") {
    process.exitCode = 1;
  }

} catch (error) {
  console.error("Program failed:", error.name);
  process.exitCode = 1;
} finally {
  clearInterval(memoryTimer);
  await sequelize.close();
}