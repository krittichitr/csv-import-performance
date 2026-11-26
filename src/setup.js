import sequelize from "./database.js";
import Customer from "./models/customer.js";

try {
  await sequelize.authenticate();
  await Customer.sync();

  console.log("Customers table created successfully");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}