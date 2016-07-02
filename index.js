'use strict';

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
const isClass = (t) => {
  return typeof t === 'function' && (/^\s*class\s+/.test(t.toString()) || /_class\S+/i.test(t.toString()));
}

const loadFiles = (paths) => {
  const rawFiles = paths.map(path => glob.sync(`${path}/**/*.js`));
  const files = _.uniq(_.flatten(rawFiles));

  return files.map((file) => {
    let relativePath = file;
    _.each(paths, path => relativePath = relativePath.replace(path, ''))

    const requirePath = file.startsWith(__dirname) ? file : `../../${file}`;

    var instance = require(requirePath);
    if (instance.default) {
      instance = instance.default;
    }
    
    if (isClass(instance)) {
      instance = new instance();
    }

    return {
      absolutePath: file,
      relativePath: relativePath,
      instance: instance
    };
  });
};

const applyConfig = (app, config) => {
  const configFuncs = loadFiles([`${__dirname}/src/config/`, `${config.src}/config/`]);

  _.each(configFuncs, f => f.instance(app));
};

const applyRoutes = (app, config) => {
  const verbs = ['get','post','put','delete'];

  const paths = [`${__dirname}/src/routes/`, `${config.src}/routes` ];
  const routes = loadFiles(paths);

  var router = express.Router();
  _.each(routes, (load) => {
    let path = load.relativePath.replace('.js', '');
    if (path.includes('index')) {
      path = path.replace('index', '');
    }

    const before = load.instance['before'];
    const after = load.instance['after'];

    _.each(verbs, (verb) => {
      if (load.instance[verb]) {
        router[verb](path, (req, res) => {
          if (before) {
            before(req, res);
          }

          load.instance[verb](req, res);

          if (after) {
            after(req, res);
          }
        });
      }
    });
  });

  app.use(router);
};

const configureSpaRoute = (app, config) => {
  if (!config.spa) {
    return;
  }

  // map to the spa app
  app.use(express.static(`${config.spa.path}`));
  app.get('*', function(req, res) {
  	res.status(200).sendFile(path.join(`${config.spa.path}/${config.spa.index}`));
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
