import { DataTypes } from "sequelize";
import sequelize from "../database.js";

const Customer = sequelize.define("Customer", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  first_name: DataTypes.STRING(100),
  last_name: DataTypes.STRING(100),
  cid: DataTypes.STRING(13),
  first_name_en: DataTypes.STRING(100),
  last_name_en: DataTypes.STRING(100),
  email: DataTypes.STRING(255),
  birth_date: DataTypes.DATEONLY
}, {
  tableName: "customers",
  timestamps: false
});

export default Customer;