'use strict';
require("use-strict");

// import
const _ = require('underscore');
const objectAssign = require('object-assign');
const express = require('express');
const glob = require('glob');
const path = require('path');

// default config
const defaultConfig = {
  src: './src',

  spa: {
    path: '/release',
    index: 'index.html'
  },

  port: 3000
};

// helper logic
const loadFiles = (paths) => {
  const rawFiles = paths.map(path => glob.sync(`${path}/**/*.js`));
  const files = _.uniq(_.flatten(rawFiles));

  return files.map((file) => {
    let relativePath = file;
    _.each(paths, path => relativePath = relativePath.replace(path, ''))

    return {
      absolutePath: file,
      relativePath: relativePath,

      instance: require(file)
    };
  });
};

const applyConfig = (app, config) => {
  const configFuncs = loadFiles(['./src/config/', `${config.src}/config/`]);

  _.each(configFuncs, f => f.instance(app));
};

const applyRoutes = (app, config) => {
  const paths = [ './src/routes', `${config.src}/routes` ];
  const routes = loadFiles(paths);

  var router = express.Router();
  _.each(routes, (load) => {
    const path = load.relativePath.replace('.js', '');
    const controller = load.instance;

    if (controller.get) {
      router.get(path, controller.get);
    }

    if (controller.post) {
      router.post(path, controller.post);
    }

    if (controller.put) {
      router.put(path, controller.put);
    }

    if (controller.delete) {
      router.delete(path, controller.delete);
    }
  });

  app.use(router);
};

const configureSpaRoute = (app, config) => {
  if (!config.spa) {
    return;
  }

  // map to the spa app
  app.use(express.static(`${__dirname}${config.spa.path}`));
  app.get('*', function(req, res) {
  	res.status(200).sendFile(path.join(`${__dirname}${config.spa.path}/${config.spa.index}`));
  });
};

// server define
const server = {
  init: (clientConfig) => {
    const config = objectAssign(defaultConfig, clientConfig);
    const app = express();

    // load config
    applyConfig(app, config);
    applyRoutes(app, config);

    configureSpaRoute(app, config);

    // run
    app.listen(process.env.PORT || config.port);
  }
};
module.exports = server;

server.init();
