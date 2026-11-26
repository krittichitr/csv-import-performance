import sequelize from "./database.js";
import Customer from "./models/customer.js";

try {
  await Customer.bulkCreate([
    {
      first_name: "สมหญิง",
      last_name: "รักดี",
      cid: "0000000000002",
      first_name_en: "Somying",
      last_name_en: "Rakdee",
      email: "somying@example.com",
      birth_date: "2001-02-10"
    },
    {
      first_name: "สมศักดิ์",
      last_name: "มีสุข",
      cid: "0000000000003",
      first_name_en: "Somsak",
      last_name_en: "Meesuk",
      email: "somsak@example.com",
      birth_date: "2002-03-20"
    }
  ]);

  console.log("Bulk insert successfully");
  console.log("Total records:", await Customer.count());
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}