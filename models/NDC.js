const { DataTypes} = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define('NDC', {
        code: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: true
        },
    }, {
        tableName: "ndc",
        createdAt: false,
        updatedAt: false
    });
}