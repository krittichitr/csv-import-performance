import sequelize from "./database.js";

try {
  await sequelize.authenticate();
  console.log("Database connected successfully");
} catch (error) {
  console.error(error.message);
} finally {
  await sequelize.close();
}