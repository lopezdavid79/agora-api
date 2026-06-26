const path = require('path');
const { Umzug, SequelizeStorage } = require('umzug');
const { sequelize } = require('./database');

const umzug = new Umzug({
  migrations: {
    glob: path.join(__dirname, '..', 'migrations', '*.js'),
    resolve: ({ name, path: migrationPath }) => {
      const migration = require(migrationPath);
      return {
        name,
        up: async () => migration.up({ queryInterface: sequelize.getQueryInterface(), sequelize }),
        down: async () => migration.down({ queryInterface: sequelize.getQueryInterface(), sequelize }),
      };
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

module.exports = umzug;
