const express = require('express');
const app = express();
const morgan = require('morgan');
const http = require('http'); 
const cors = require('cors');
const mysql = require('mysql2');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const bcrypt = require('bcrypt');
const flash = require('express-flash');
const socketIo = require('socket.io');
const server = http.createServer(app);
const io = socketIo(server);
app.set('view engine', 'ejs');

// Configura la conexión a la base de datos
const dbConfig= {
  host: '190.228.29.61',
  user: 'kalel2016',
  password: 'Kalel2016',
  database: 'ausol',
  connectTimeout: 360000,
};
const db = mysql.createConnection(dbConfig);

db.connect((err) => {
  if (err) {
    console.error('Error al conectar a la base de datos: ' + err.stack);
    return;
  }
  console.log('Conexión a la base de datos establecida');
});


// Middlewares
app.use(morgan('combined'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

// Configura la sesión de Passport
app.use(
  session({
    secret: 'S1e7b0@3', // Cambia esto a un valor seguro en producción
    resave: false,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash()); // Middleware para manejar mensajes flash

app.get('/', (req, res) => {
  // Obtener el mensaje de error o éxito si está presente
  const message = req.flash('message');

  // Renderizar la página login.ejs y pasar el mensaje como contexto
  res.render('login', { message: message });
  
});


app.get('/index', (req, res) => {
  // Verifica si el usuario está autenticado
  if (req.isAuthenticated()) {
    // El usuario está autenticado, muestra la página principal con sus datos
    res.render('index', { user: req.user });
  } else {
    // El usuario no está autenticado, redirige a la página de inicio de sesión
    res.redirect('/login');
  }
});




// Ruta para iniciar sesión
app.post(
  '/login',
  passport.authenticate('local', {
    successRedirect: '/precios', // Redirige a la página principal si la autenticación es exitosa
    failureRedirect: '/login', // Redirige de nuevo a la página de inicio de sesión en caso de error de autenticación
    failureFlash: true, // Habilita mensajes flash en caso de error
  })
);

// Ruta para mostrar la página de inicio de sesión
app.get('/login', (req, res) => {
  const db = mysql.createConnection(dbConfig);
  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end(); // Asegúrate de cerrar la conexión en caso de error
      return res.status(500).send('Error en el servidor');
    }
  // Verifica si el usuario está autenticado
  if (req.isAuthenticated()) {
    // El usuario está autenticado, redirige a la página principal
    console.log('usuario autenticado, conexion cerrada')
    db.end();
    res.redirect('/index');
  } else {
    // El usuario no está autenticado, muestra la página de inicio de sesión
    
    res.render('login', { message: req.flash('error') }); // Aquí estás pasando el mensaje flash
    db.end();
}
});
});

const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next(); // El usuario está autenticado, continúa con la siguiente función

  }
  res.redirect('/login'); // El usuario no está autenticado, redirige a la página de inicio de sesión
};


// Ruta para obtener datos de la oferta
app.get('/obtenerOferta', (req, res) => {
  // Consultar la base de datos para obtener la oferta más reciente
  const db = mysql.createConnection(dbConfig);
  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end(); // Asegúrate de cerrar la conexión en caso de error
      return res.status(500).send('Error en el servidor');
    }
  
    const consulta = 'SELECT * FROM ofertas';


    db.query(consulta, (error, resultados) => {
      if (error) {
        console.error('Error al obtener oferta desde la base de datos:', error.message);
        res.status(500).json({ error: 'Error al obtener oferta' });
      } else {
        const oferta = resultados; // Tomar todas las ofertas

        // Enviar la información de la oferta al cliente
        res.json({
          ofertaVigente: oferta.length > 0,
          ofertas: oferta
        });

      }
        // Cerrar la conexión después de usarla
        db.end();
        console.log('conexion cerrada');
    });
  });
});



// Ruta para mostrar la página de precios con paginación
app.get('/precios', isAuthenticated, (req, res) => {
  const filtro = req.query.filtro;
  const codproveedor = parseInt(req.query.codproveedor);
  const user = req.user;
  const articulo = req.query.articulo;
  const posicion = req.query.posicion;
  const modelo = req.query.modelo;
  const marca = req.query.marca;
  const tableName = `famer_${user.codcliente}`;
  const resultsPerPage = 100; // Cantidad de resultados por página
  const page = req.query.page || 1; // Página actual, predeterminada a 1 si no se proporciona en la URL
  const offset = (page - 1) * resultsPerPage; // Calcular el offset
  const db = mysql.createConnection(dbConfig);

  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end(); // Asegúrate de cerrar la conexión en caso de error
      return res.status(500).send('Error en el servidor');
    }
  let sql = `
    SELECT f.codarticulo, f.descrip, f.precioneto, f.stockmisiones, f.stockcorriente, f.nombreimagen,
    f.equivalencia1, f.equivalencia2, f.equivalencia3,
    ${tableName}.preciocosto, ${tableName}.ivacosto, ${tableName}.precioventa
    FROM famer AS f
    LEFT JOIN ${tableName} ON f.idarticulo = ${tableName}.idarticulo
  `;

  let sqlParams = [];

  if (filtro) {
    sql += `
      WHERE f.codarticulo LIKE ? OR f.descrip LIKE ?
    `;
    const searchValue = `%${filtro}%`;
    sqlParams = [searchValue, searchValue];
  } else if (codproveedor) {
    sql += `
      WHERE f.codproveedor = ?
    `;
    sqlParams = [codproveedor];
  }

  sql += `
    LIMIT ? OFFSET ?
  `;

  sqlParams.push(resultsPerPage, offset);

  db.query(sql, sqlParams, (err, results) => {
    if (err) {
      console.error('Error al obtener los precios de artículos: ' + err.message);
      return res.status(500).send('Error en el servidor');
    }

    // Calcular la cantidad total de páginas
    db.query('SELECT COUNT(*) AS count FROM famer', (err, countResults) => {
      if (err) {
        console.error('Error al obtener la cantidad total de registros: ' + err.message);
        return res.status(500).send('Error en el servidor');
      }

      const totalCount = countResults[0].count;
      const totalPages = Math.ceil(totalCount / resultsPerPage);
      // Cerrar la conexión después de usarla
        db.end();
        console.log('conexion cerrada');

      res.render('precios', {
        precios: results,
        user,
        noResults: results.length === 0,
        currentPage: page,
        totalPages: totalPages,
      });
    });
  });
});
});


app.get('/filtroprecios', isAuthenticated, (req, res) => {
  const user = req.user;
  const filtroArticulo = req.query.articulo;
  const filtroPosicion = req.query.posicion;
  const filtroModelo = req.query.modelo;
  const filtroMarca = req.query.marca;
  const tableName = `famer_${user.codcliente}`;
  const page = req.query.page || 1;
  const totalPages = 1;
  
  // Crear un array para almacenar las condiciones válidas
  const validConditions = [];
  const db = mysql.createConnection(dbConfig);
  console.log('tabla abierta'+ db)
  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end(); // Asegúrate de cerrar la conexión en caso de error
      return res.status(500).send('Error en el servidor');
    }
  // Comprobar si cada filtro tiene un valor y agregar la condición correspondiente
  if (filtroArticulo) {
    validConditions.push(`f.descrip LIKE ?`);
  }
  if (filtroPosicion) {
    validConditions.push(`f.descrip LIKE ?`);
  }
  if (filtroModelo) {
    validConditions.push(`f.descrip LIKE ?`);
  }
  if (filtroMarca) {
    validConditions.push(`f.descrip LIKE ?`);
  }

  // Verificar que haya al menos 2 condiciones válidas
  if (validConditions.length >= 1) {
    let sql = `
      SELECT f.codarticulo, f.descrip, f.precioneto, f.stockmisiones, f.stockcorriente, f.nombreimagen, 
      f.equivalencia1, f.equivalencia2, f.equivalencia3,
      ${tableName}.preciocosto, ${tableName}.ivacosto, ${tableName}.precioventa
      FROM famer AS f
      LEFT JOIN ${tableName} ON f.idarticulo = ${tableName}.idarticulo
      WHERE ${validConditions.join(' AND ')}`;
      
    let sqlParams = [];
    
    // Agregar los valores de los filtros a sqlParams
    if (filtroArticulo) {
      const searchValue = `%${filtroArticulo}%`;
      sqlParams.push(searchValue);
    }
    if (filtroPosicion) {
      const searchValue = `%${filtroPosicion}%`;
      sqlParams.push(searchValue);
    }
    if (filtroModelo) {
      const searchValue = `%${filtroModelo}%`;
      sqlParams.push(searchValue);
    }
    if (filtroMarca) {
      const searchValue = `%${filtroMarca}%`;
      sqlParams.push(searchValue);
    }

    db.query(sql, sqlParams, (err, results) => {
      if (err) {
        console.error('Error al obtener los precios de artículos filtrados: ' + err.message);
        return res.status(500).send('Error en el servidor');
      }
      
      // Cerrar la conexión después de usarla
      db.end();
      console.log('cierre de conexion')

      res.render('precios', {
        precios: results,
        user,
        noResults: results.length === 0,
        currentPage: page, // Agrega currentPage a los datos que se envían a la vista
        totalPages: totalPages,
      });
    });
  } else {
    // Si no hay al menos 2 condiciones válidas, mostrar un mensaje o redirigir a otra página
    res.send('Debe ingresar al menos 2 filtros válidos para la búsqueda.');
  }
});
});


////////////////////////////////////////////////////////////////////////////////////////

// Ruta para calcular el precio de venta y actualizar la base de datos
app.post('/calcular-precio-venta/:codproveedor', isAuthenticated, (req, res) => {
  const codcliente = req.user.codcliente;
  const tableNameFamer = 'famer_' + codcliente;
  const tableNameFaproCodcliente = 'fapro_' + codcliente;
  const codproveedor = req.params.codproveedor;

  const db = mysql.createConnection(dbConfig);

  db.connect((err) => {
      if (err) {
          console.error('Error al conectar a la base de datos: ' + err.stack);
          db.end();
          return res.status(500).send('Error en el servidor');
      }

      // Obtener los idarticulos asociados al proveedor en la tabla famer
      const getItemsSQL = `
          SELECT idarticulo FROM famer
          WHERE codproveedor = ?;
      `;

      db.query(getItemsSQL, [codproveedor], (err, results) => {
          if (err) {
              console.error('Error al obtener los idarticulos asociados al proveedor: ' + err.message);
              return res.json({ success: false, message: 'Error al obtener los idarticulos asociados al proveedor' });
          }

          const idarticulos = results.map(result => result.idarticulo);

          // Eliminar los idarticulos de la tabla famer
          const deleteItemsSQL = `
              DELETE FROM ${tableNameFamer}
              WHERE idarticulo IN (?);
          `;

          db.query(deleteItemsSQL, [idarticulos], (err) => {
              if (err) {
                  console.error('Error al eliminar los idarticulos del proveedor: ' + err.message);
                  return res.json({ success: false, message: 'Error al eliminar los idarticulos del proveedor' });
              }

              // Proceder con la consulta de actualización de precios
              const itemId = req.body.id; // Asegúrate de enviar este dato desde el cliente

              // Consulta SQL para verificar si el artículo existe en la tabla famer_+codcliente
              const checkItemExistsSQL = `
                  SELECT COUNT(*) AS rowCount FROM ${tableNameFamer}
                  WHERE idarticulo = ?;
              `;

              db.query(checkItemExistsSQL, [itemId], (err, results) => {
                  if (err) {
                      console.error('Error al verificar si el artículo existe en famer_+codcliente: ' + err.message);
                      return res.json({ success: false, message: 'Error en el servidor' });
                  }

                  const rowCount = results[0].rowCount;
                  let updatePricesSQL;

              if (rowCount === 0) {
                  updatePricesSQL = `
                      INSERT INTO ${tableNameFamer} (idarticulo, preciocosto, ivacosto, precioventa)
                      SELECT f.idarticulo,
                              (f.precioneto - (f.precioneto * p.descuento / 100)),
                              ((f.precioneto - (f.precioneto * p.descuento / 100)) * 21 / 100),
                              ((f.precioneto - (f.precioneto * p.descuento / 100)) +
                              ((f.precioneto - (f.precioneto * p.descuento / 100)) * 21 / 100) +
                              ((f.precioneto - (f.precioneto * p.descuento / 100)) * p.utilidad / 100))
                      FROM famer AS f
                      JOIN ${tableNameFaproCodcliente} AS p ON f.codproveedor = p.codproveedor
                      WHERE f.codproveedor = ?;
                  `;
              } else {
                  updatePricesSQL = `
                      UPDATE ${tableNameFamer} AS fc
                      JOIN famer AS f ON fc.idarticulo = f.idarticulo
                      JOIN ${tableNameFaproCodcliente} AS p ON f.codproveedor = p.codproveedor
                      SET fc.preciocosto = (f.precioneto - (f.precioneto * p.descuento / 100)),
                          fc.ivacosto = ((f.precioneto - (f.precioneto * p.descuento / 100)) * 21 / 100),
                          fc.precioventa = ((f.precioneto - (f.precioneto * p.descuento / 100)) +
                                          ((f.precioneto - (f.precioneto * p.descuento / 100)) * 21 / 100) +
                                          ((f.precioneto - (f.precioneto * p.descuento / 100)) * p.utilidad / 100))
                      WHERE f.codproveedor = ?;
                  `;
              }

              db.query(updatePricesSQL, [codproveedor], (err) => {
                if (err) {
                    console.error('Error al calcular y actualizar el precio de venta: ' + err.message);
                    return res.json({ success: false, message: 'Error al calcular el precio de venta' });
                } else {
                    return res.json({ success: true, message: 'Cálculo de precio de venta exitoso' });
                }
            });

            db.end();
        });
    });
});
});
});

/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////

// Ruta para mostrar el carrito de misiones
app.get('/carritomisiones', isAuthenticated, (req, res) => {
  // Consulta a la base de datos para obtener los elementos del carrito de misiones del usuario
  const tableName = `carritomisiones_${req.user.codcliente}`;
  const db = mysql.createConnection(dbConfig);
  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end(); // Asegúrate de cerrar la conexión en caso de error
      return res.status(500).send('Error en el servidor');
    }

  db.query(`SELECT * FROM \`${tableName}\``, (err, carrito) => {
      if (err) {
          console.error('Error al obtener el carrito de misiones: ' + err.message);
          return res.status(500).send('Error en el servidor');
      }
      // Renderiza la vista 'carritomisiones.ejs' y pasa los datos obtenidos como 'carrito'
      db.end();
      res.render('carritomisiones', { carrito });
  });
});
});
// Ruta para procesar el formulario de envío del pedido de misiones
app.post('/enviarPedidoMisiones', isAuthenticated, (req, res) => {
  const user = req.user;
  const tableName = `carritomisiones_${user.codcliente}`;

  // Procesa el formulario de envío del pedido aquí
  // Realiza las operaciones necesarias para guardar el pedido en la base de datos

  // Redirige al usuario a la página de carrito de misiones actualizada o a donde corresponda
  res.redirect('/carritomisiones');
});

// Ruta para mostrar el carrito de corrientes
app.get('/carritocorrientes', isAuthenticated, (req, res) => {
  // Consulta a la base de datos para obtener los elementos del carrito de corrientes del usuario
  const tableName = `carritocorrientes_${req.user.codcliente}`;
  const db = mysql.createConnection(dbConfig);
  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end(); // Asegúrate de cerrar la conexión en caso de error
      return res.status(500).send('Error en el servidor');
    }
  db.query(`SELECT * FROM \`${tableName}\``, (err, carrito) => {
      if (err) {
          console.error('Error al obtener el carrito de corrientes: ' + err.message);
          return res.status(500).send('Error en el servidor');
      }
      db.end();
      // Renderiza la vista 'carritocorrientes.ejs' y pasa los datos obtenidos como 'carrito'
      res.render('carritocorrientes', { carrito });
  });
});
});
// Ruta para procesar el formulario de envío del pedido de corrientes
app.post('/enviarPedidoCorrientes', isAuthenticated, (req, res) => {
  const user = req.user;
  const tableName = `carritocorrientes_${user.codcliente}`;

  // Procesa el formulario de envío del pedido aquí
  // Realiza las operaciones necesarias para guardar el pedido en la base de datos

  // Redirige al usuario a la página de carrito de corrientes actualizada o a donde corresponda
  res.redirect('/carritocorrientes');
});






// Ruta para mostrar la página de proveedores
app.get('/proveedor', isAuthenticated, (req, res) => {
  const db = mysql.createConnection(dbConfig);
  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end(); // Asegúrate de cerrar la conexión en caso de error
      return res.status(500).send('Error en el servidor');
    }
  // Consulta a la base de datos para obtener los datos de la tabla 'fapro'
  db.query('SELECT * FROM fapro', (err, results) => {
    if (err) {
      console.error('Error al obtener los proveedores: ' + err.message);
      return res.status(500).send('Error en el servidor');
    }
    // Obtén la información del usuario autenticado (si está autenticado)
    const user = req.user;
    db.end();
    // Renderiza la vista 'proveedor.ejs' y pasa los datos obtenidos como 'proveedores' al template
    res.render('proveedor', { proveedores: results, user: user });
  });
});
});



app.post('/crearTabla', isAuthenticated, (req, res) => {
  const user = req.user;
  const codcliente = user.codcliente;
  const tableNameFamer = `famer_${codcliente}`;
  const tableNameCarritoMisiones = `carritomisiones_${codcliente}`;
  const tableNameCarritoCorrientes = `carritocorrientes_${codcliente}`;
  const tableNameCarritoHistoricoMisiones = `carritohistoricomis_${codcliente}`;
  const tableNameCarritoHistoricoCorrientes = `carritohistoricocorr_${codcliente}`;
  const tableNamefaprocodcliente = `fapro_${codcliente}`;
  const tableNameFapro = 'fapro';
  const db = mysql.createConnection(dbConfig);
  const tableNameFamerCodcliente = `famer_${codcliente}`;

  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end();
      return res.status(500).send('Error en el servidor');
    }

    // Verificar si la tabla "famer" existe
    db.query(`SHOW TABLES LIKE '${tableNameFamer}'`, (err, result) => {
      if (err) {
        console.error('Error al verificar si la tabla famer existe: ' + err.message);
        db.end();
        return res.status(500).send('Error en el servidor');
      }

      if (result.length === 0) {
        // La tabla "famer" no existe, crea la tabla con la estructura adecuada
        const createTableSQLFamer = `
          CREATE TABLE \`${tableNameFamer}\` (
            idarticulo INT,
            ivacosto DECIMAL(10, 2),
            preciocosto DECIMAL(10, 2),
            precioventa DECIMAL(10, 2),
            codusuario INT
          )
        `;

        db.query(createTableSQLFamer, (err) => {
          if (err) {
            console.error('Error al crear la tabla famer: ' + err.message);
            db.end();
            return res.status(500).send('Error en el servidor');
          }

          // Crea la tabla "carritomisiones+codcliente"
          const createTableSQLCarritoMisiones = `
            CREATE TABLE \`${tableNameCarritoMisiones}\` (
              id INT AUTO_INCREMENT PRIMARY KEY,
              fecha DATETIME,
              codarticulo VARCHAR(255),
              descrip VARCHAR(255),
              cantidad INT,
              precio DECIMAL(10, 2),
              total DECIMAL(10, 2),
              observacion VARCHAR(255),
              codcliente INT
            )
          `;

          db.query(createTableSQLCarritoMisiones, (err) => {
            if (err) {
              console.error('Error al crear la tabla carritomisiones: ' + err.message);
              db.end();
              return res.status(500).send('Error en el servidor');
            }

            // Crea la tabla "carritocorriente+codcliente"
            const createTableSQLCarritoCorrientes = `
              CREATE TABLE \`${tableNameCarritoCorrientes}\` (
                id INT AUTO_INCREMENT PRIMARY KEY,
                fecha DATETIME,
                codarticulo VARCHAR(255),
                descrip VARCHAR(255),
                cantidad INT,
                precio DECIMAL(10, 2),
                total DECIMAL(10, 2),
                observacion VARCHAR(255),
                codcliente INT
              )
            `;

            db.query(createTableSQLCarritoCorrientes, (err) => {
              if (err) {
                console.error('Error al crear la tabla carritocorrientes: ' + err.message);
                db.end();
                return res.status(500).send('Error en el servidor');
              }

              // Crea la tabla "carritohistoricomis+codcliente"
              const createTableSQLCarritoHistoricoMisiones = `
                CREATE TABLE \`${tableNameCarritoHistoricoMisiones}\` (
                  id INT AUTO_INCREMENT PRIMARY KEY,
                  fecha DATETIME,
                  codarticulo VARCHAR(255),
                  descrip VARCHAR(255),
                  cantidad INT,
                  precio DECIMAL(10, 2),
                  total DECIMAL(10, 2),
                  observacion VARCHAR(255),
                  codcliente INT
                )
              `;

              db.query(createTableSQLCarritoHistoricoMisiones, (err) => {
                if (err) {
                  console.error('Error al crear la tabla carritohistoricomis: ' + err.message);
                  db.end();
                  return res.status(500).send('Error en el servidor');
                }

                // Crea la tabla "carritohistoricocorr+codcliente"
                const createTableSQLCarritoHistoricoCorrientes = `
                  CREATE TABLE \`${tableNameCarritoHistoricoCorrientes}\` (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    fecha DATETIME,
                    codarticulo VARCHAR(255),
                    descrip VARCHAR(255),
                    cantidad INT,
                    precio DECIMAL(10, 2),
                    total DECIMAL(10, 2),
                    observacion VARCHAR(255),
                    codcliente INT
                  )
                `;

                db.query(createTableSQLCarritoHistoricoCorrientes, (err) => {
                  if (err) {
                    console.error('Error al crear la tabla carritohistoricocorr: ' + err.message);
                    db.end();
                    return res.status(500).send('Error en el servidor');
                  }

                  // Crea la tabla "fapro+codcliente"
                  const createTableSQLFaproCodcliente = `
                    CREATE TABLE \`${tableNamefaprocodcliente}\` (
                      id INT AUTO_INCREMENT PRIMARY KEY,
                      codproveedor INT,
                      descripcion VARCHAR(255),
                      descuento INT DEFAULT 0,
                      utilidad INT DEFAULT 0
                    )
                  `;

                  db.query(createTableSQLFaproCodcliente, (err) => {
                    if (err) {
                      console.error('Error al crear la tabla fapro: ' + err.message);
                      db.end();
                      return res.status(500).send('Error en el servidor');
                    }

                    // Consulta SQL para seleccionar los datos de la tabla fapro
                    const selectDatasSQL = `
                      SELECT id, codproveedor, descripcion
                      FROM ${tableNameFapro};
                    `;
                    const insertDatasSQL = `
                      INSERT INTO ${tableNamefaprocodcliente} (id, codproveedor, descripcion)
                      ${selectDatasSQL};
                    `;

                    db.query(insertDatasSQL, (err, result) => {
                      if (err) {
                        console.error('Error al transferir los datos: ' + err.message);
                        db.end();
                        return res.status(500).send('Error en el servidor');
                      }

                      // Obtener utilidad y descuento del usuario logueado desde la tabla facli
                      const getUtilidadDescuentoSQL = `
                        SELECT utilidad, descuento FROM facli WHERE codcliente = ?;
                      `;

                      db.query(getUtilidadDescuentoSQL, [codcliente], (err, results) => {
                        if (err) {
                          console.error('Error al obtener la utilidad y descuento del usuario: ' + err.message);
                          db.end();
                          return res.status(500).send('Error en el servidor');
                        }

                        const utilidad = results[0].utilidad;
                        const descuento = results[0].descuento;


                        // Consulta SQL para transferir los datos de famer a famer_+codcliente
                        const transferDataSQL = `
                          INSERT INTO ${tableNameFamerCodcliente} (idarticulo, ivacosto, preciocosto, precioventa)
                          SELECT f.idarticulo,
                                ((f.precioneto - (f.precioneto * fl.descuento / 100)) * 21 / 100) AS ivacosto,
                                (f.precioneto - (f.precioneto * fl.descuento / 100)) AS preciocosto,
                                ((f.precioneto - (f.precioneto * fl.descuento / 100)) +
                                  ((f.precioneto - (f.precioneto * fl.descuento / 100)) * 21 / 100) +
                                  ((f.precioneto - (f.precioneto * fl.descuento / 100)) * fl.utilidad / 100)) AS precioventa
                          FROM famer AS f
                          JOIN facli AS fl ON fl.codcliente = ${codcliente};
                        `;

                        db.query(transferDataSQL, (err) => {
                          if (err) {
                            console.error('Error al transferir datos a la tabla famer_+codcliente: ' + err.message);
                            db.end();
                            return res.status(500).send('Error en el servidor');
                          }

                          // Redirige a la página de precios u otra página según tus necesidades
                          res.redirect('/precios');
                          db.end();
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      } else {
        // La tabla "famer" ya existe, redirige a la página de precios u otra página según tus necesidades
        res.redirect('/precios');
        db.end();
      }
    });
  });
});


app.post('/cargarCarrito', isAuthenticated, (req, res) => {
  const user = req.user;
  const codcliente = user.codcliente;
  const codarticulo = req.body.codarticulo;
  const cantidad = req.body.cantidad;
  const carrito = req.body.carrito; // "misiones" o "corrientes"

  const tableNameFamer = `famer`;
  const tableNameCarrito = `carrito${carrito}_${codcliente}`;
  const db = mysql.createConnection(dbConfig);

  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end(); // Asegúrate de cerrar la conexión en caso de error
      return res.status(500).send('Error en el servidor');
    }
  // Obtener el artículo de la tabla "famer" por codarticulo
  const selectArticleSQL = `
      SELECT codarticulo, descrip, precioneto
      FROM ${tableNameFamer} 
      WHERE codarticulo = ?
  `;

  db.query(selectArticleSQL, [codarticulo], (err, result) => {
      if (err) {
          console.error('Error al obtener el artículo: ' + err.message);
          return res.status(500).send('Error en el servidor');
      }

      if (result.length === 0) {
          // El artículo no existe en la tabla "famer"
          return res.status(404).send('El artículo no existe.');
      }

      const article = result[0];
      const precio = article.precioneto;
      const total = cantidad * precio;

      // Obtener la fecha actual del sistema
      const currentDate = new Date();
      const formattedDate = currentDate.toISOString().split('T')[0]; // Obtener solo la fecha en formato 'YYYY-MM-DD'
      
      // Insertar el artículo en el carrito correspondiente con la fecha actual
      const insertCarritoSQL = `
          INSERT INTO ${tableNameCarrito} (fecha, codarticulo, descrip, cantidad, precio, total, codcliente)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          
      `;
      
      db.query(insertCarritoSQL, [formattedDate, codarticulo, article.descrip, cantidad, precio, total, codcliente], (err) => {
        if (err) {
            console.error('Error al cargar el artículo en el carrito: ' + err.message);
            return res.status(500).send('Error en el servidor');
        }
        
        // Éxito, el artículo se cargó en el carrito
       res.status(200).send('Artículo cargado en el carrito con éxito.');
       //res.sendFile('/views/mensaje.html', { root: __dirname });
        // Cerrar la conexión después de usarla
        db.end();
    });
  });
});
});

///////////////////////////////////////////////////////////////////
//////////////////desde equivalencia//////////////////////////////
app.get('/equivalencia', isAuthenticated, (req, res) => {
  const user = req.user;
  const page = req.query.page || 1;
  const totalPages = 1;
  const codigoArticulo = req.query.codigo; // Obtener el código de artículo desde la URL
  const db = mysql.createConnection(dbConfig);
  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end(); // Asegúrate de cerrar la conexión en caso de error
      return res.status(500).send('Error en el servidor');
    }

  if (codigoArticulo) {
    // Si se proporciona un código de artículo, buscar y mostrar los detalles
    const tableNameFamer = `famer`;
    const selectArticuloSQL = `
      SELECT * FROM ${tableNameFamer} WHERE codarticulo = ?;
    `;

    db.query(selectArticuloSQL, [codigoArticulo], (err, result) => {
      if (err) {
        console.error('Error al obtener los detalles del artículo: ' + err.message);
        return res.status(500).send('Error en el servidor');
      }

      if (result.length === 0) {
        // El artículo no existe en la base de datos
        return res.status(404).send('El artículo no existe.');
      }

      // Renderiza la vista "precios.ejs" con los detalles del artículo
      const articulo = result[0];
      res.render('precios', {
        user,
        precios: [articulo],
        noResults: result.length === 0,
        currentPage: page,
        totalPages: totalPages,
      });
    });
  } else {
    // Si no se proporciona un código de artículo, mostrar la página sin detalles
    db.end();
    res.redirect('/precios');
  }
});
});


///////////////////fin/////////////////////////////////////
app.post('/eliminarArticuloMisiones/:id', isAuthenticated, (req, res) => {
  const user = req.user;
  const itemId = req.params.id; // Obtener el ID del artículo a eliminar desde la URL
  const tableNameCarrito = `carritomisiones_${user.codcliente}`;
  const db = mysql.createConnection(dbConfig);
  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end(); // Asegúrate de cerrar la conexión en caso de error
      return res.status(500).send('Error en el servidor');
    }
  // Realiza la lógica para eliminar el artículo con el ID especificado del carrito de Misiones
  const deleteItemSQL = `
    DELETE FROM ${tableNameCarrito} WHERE id = ?;
  `;

  db.query(deleteItemSQL, [itemId], (err, result) => {
    if (err) {
      console.error('Error al eliminar el artículo del carrito de Misiones: ' + err.message);
      return res.status(500).send('Error en el servidor');
    }
    db.end();
    // Redirige de vuelta a la página del carrito de Misiones o a donde desees después de eliminar
    res.redirect('/carritoMisiones'); // Cambia esto si necesitas redirigir a una página diferente
  });
});
});

app.post('/limpiarCarritoMisiones', isAuthenticated, (req, res) => {
  const user = req.user;
  const tableNameCarrito = `carritomisiones_${user.codcliente}`;
  const db = mysql.createConnection(dbConfig);
  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end(); // Asegúrate de cerrar la conexión en caso de error
      return res.status(500).send('Error en el servidor');
    }
  // Realiza la lógica para limpiar completamente el carrito de Misiones
  const deleteAllItemsSQL = `
    DELETE FROM ${tableNameCarrito};
  `;

  db.query(deleteAllItemsSQL, (err, result) => {
    if (err) {
      console.error('Error al limpiar el carrito de Misiones: ' + err.message);
      return res.status(500).send('Error en el servidor');
    }
    db.end();
    // Redirige de vuelta a la página del carrito de Misiones o a donde desees después de limpiar
    res.redirect('/carritoMisiones'); // Cambia esto si necesitas redirigir a una página diferente
  });
});
});

app.post('/eliminarArticuloCorrientes/:id', isAuthenticated, (req, res) => {
  const user = req.user;
  const itemId = req.params.id; // Obtener el ID del artículo a eliminar desde la URL
  const tableNameCarrito = `carritocorrientes_${user.codcliente}`;
  const db = mysql.createConnection(dbConfig);
  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end(); // Asegúrate de cerrar la conexión en caso de error
      return res.status(500).send('Error en el servidor');
    }
  // Realiza la lógica para eliminar el artículo con el ID especificado del carrito de Misiones
  const deleteItemSQL = `
    DELETE FROM ${tableNameCarrito} WHERE id = ?;
  `;

  db.query(deleteItemSQL, [itemId], (err, result) => {
    if (err) {
      console.error('Error al eliminar el artículo del carrito de Corrientes: ' + err.message);
      return res.status(500).send('Error en el servidor');
    }
    db.end();
    // Redirige de vuelta a la página del carrito de Misiones o a donde desees después de eliminar
    res.redirect('/carritocorrientes'); // Cambia esto si necesitas redirigir a una página diferente
  });
});
});
app.post('/limpiarCarritoCorrientes', isAuthenticated, (req, res) => {
  const user = req.user;
  const tableNameCarrito = `carritocorrientes_${user.codcliente}`;
  const db = mysql.createConnection(dbConfig);
  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end(); // Asegúrate de cerrar la conexión en caso de error
      return res.status(500).send('Error en el servidor');
    }
  // Realiza la lógica para limpiar completamente el carrito de Misiones
  const deleteAllItemsSQL = `
    DELETE FROM ${tableNameCarrito};
  `;

  db.query(deleteAllItemsSQL, (err, result) => {
    if (err) {
      console.error('Error al limpiar el carrito de Corrinetes: ' + err.message);
      return res.status(500).send('Error en el servidor');
    }
    db.end();
    // Redirige de vuelta a la página del carrito de Misiones o a donde desees después de limpiar
    res.redirect('/carritocorrientes'); // Cambia esto si necesitas redirigir a una página diferente
  });
});
});
/////////////////////////////////////////////////////////////////////
/////////////////envio del correo///////////////////////////////////



// ... Configuración de tu servidor y base de datos ...

app.post('/enviarpm', isAuthenticated, (req, res) => {
  console.log("puto")
  const ExcelJS = require('exceljs');
  const fs = require('fs');
  const nodemailer = require('nodemailer'); // Cambia la importación a nodemailer
  const user = req.user;
  const codcliente = user.codcliente;
  const tableNameCarrito = `carritomisiones_${codcliente}`;
  const tableNameHistoricoMisiones = `carritohistoricomis_${codcliente}`;
  const db = mysql.createConnection(dbConfig);
  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end(); // Asegúrate de cerrar la conexión en caso de error
      return res.status(500).send('Error en el servidor');
    }
  // Realiza la lógica para obtener los datos del carrito de Misiones
  const selectItemsSQL = `
    SELECT * FROM ${tableNameCarrito};
  `;

  db.query(selectItemsSQL, (err, result) => {
    if (err) {
      console.error('Error al obtener los elementos del carrito de Misiones: ' + err.message);
      return res.status(500).send('Error en el servidor');
    }

    const carritoData = result; // Los datos del carrito de Misiones

    // Inserta los datos del carrito en la tabla de historial
    const insertHistoricoSQL = `
      INSERT INTO ${tableNameHistoricoMisiones} (fecha, codarticulo, descrip, cantidad, precio, total, observacion, codcliente)
      SELECT NOW(), codarticulo, descrip, cantidad, precio, total, observacion, ${codcliente}
      FROM ${tableNameCarrito};
    `;

    db.query(insertHistoricoSQL, (err) => {
      if (err) {
        console.error('Error al insertar datos en la tabla de historial: ' + err.message);
        return res.status(500).send('Error en el servidor');
      }

      // Crear un archivo Excel con los datos del carrito
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Pedido Misiones');

      // Agrega los datos del carrito al archivo Excel
      worksheet.columns = [
        { header: 'Código de Artículo', key: 'codarticulo' },
        { header: 'Descripción', key: 'descrip' },
        { header: 'Cantidad', key: 'cantidad' },
        { header: 'observacion', key: 'observacion' },
        { header: 'codcliente', key: 'codcliente' },
        // Agrega más columnas según tus necesidades
      ];

      carritoData.forEach((item) => {
        worksheet.addRow({
          codarticulo: item.codarticulo,
          descrip: item.descrip,
          cantidad: item.cantidad,
          observacion: item.observacion,
          codcliente: item.codcliente,
          // Agrega más propiedades según las columnas que quieras incluir

        });
      });

      // Guarda el archivo Excel en un archivo temporal
      const excelFileName = 'pedido_misiones.xlsx';
      const excelFilePath = `./temp/${excelFileName}`;

      workbook.xlsx.writeFile(excelFilePath)
        .then(() => {
          // Configura el transporte de correo electrónico con nodemailer
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: 'sebastian.autopartessolsrl@gmail.com',
              pass: 'ggnc ejkc amov pihv',
            },
          });

          // Configura el mensaje de correo electrónico
          const mailOptions = {
            from: 'sebastian.autopartessolsrl@gmail.com',
            to: user.email,
            subject: 'Pedido de Repuestos para Misiones',
            text: req.body.comentario || 'Sin comentario adicional',
            attachments: [
              {
                filename: 'pedido_misiones.xlsx',
                path: excelFilePath, // Utiliza el archivo Excel guardado
              },
            ],
          };

          // Envía el correo electrónico con nodemailer
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error('Error al enviar el correo electrónico: ' + error);
              return res.status(500).send('Error en el servidor');
            }

            console.log('Correo electrónico enviado a: ' + user.email);
            console.log('Mensaje: ' + req.body.comentario || 'Sin comentario adicional');
            console.log('Archivo adjunto: ' + excelFileName);

            // Borra el archivo temporal después de enviar el correo
            fs.unlinkSync(excelFilePath);

            // Borra los registros del carrito de Misiones
            const deleteItemsSQL = `
              DELETE FROM ${tableNameCarrito};
            `;

            db.query(deleteItemsSQL, (err) => {
              if (err) {
                console.error('Error al borrar los elementos del carrito de Misiones: ' + err.message);
                return res.status(500).send('Error en el servidor');
              }

              console.log('Registros del carrito de Misiones eliminados con éxito');
              req.flash('success', 'Pedido enviado y carrito limpiado');
              db.end();
              // Envía una respuesta JSON al cliente indicando éxito
              res.redirect('/carritomisiones');
            });
          });
        });
    });
  });
});
});

app.get('/masrotacion', isAuthenticated, (req, res) => {
  const user = req.user;
  const db = mysql.createConnection(dbConfig);
  // Aquí debes escribir la consulta para obtener los 10 artículos más vendidos
  // y almacenarlos en una variable 'articulosMasRotacion' o algo similar.
  // Asegúrate de ordenar los resultados por la cantidad de ventas.
  // Por ejemplo:
  const selectMasRotacionSQL = `
    SELECT f.codarticulo, f.descrip, f.precioneto, f.preciocosto, f.ivacosto, f.precioventa,
    f.equivalencia1, f.equivalencia2, f.equivalencia3, f.stockmisiones, f.stockcorriente, f.nombreimagen
    FROM famer AS f
    LEFT JOIN carritohistoricomis_${user.codcliente} AS chm ON f.codarticulo = chm.codarticulo
    LEFT JOIN carritohistoricocorr_${user.codcliente} AS chc ON f.codarticulo = chc.codarticulo
    ORDER BY (COALESCE(chm.cantidad, 0) + COALESCE(chc.cantidad, 0)) DESC
    LIMIT 10;
  `;

  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end();
      return res.status(500).send('Error en el servidor');
    }

    db.query(selectMasRotacionSQL, (err, resultados) => {
      if (err) {
        console.error('Error al obtener los artículos más vendidos: ' + err.message);
        db.end();
        return res.status(500).send('Error en el servidor');
      }

      // Renderiza la vista "precios.ejs" con los artículos más vendidos
      res.render('precios', {
        user,
        precios: resultados,
        currentPage: 1,  // Puedes establecer la página actual como 1
        totalPages: 1,  // Puedes establecer el total de páginas como 1
      });

      // Cierra la conexión a la base de datos
      db.end();
    });
  });
});

/////////////////////////////////////////////////////////////////////
/////////////////fin///////////////////////////////////
/////////////////////////////////////////////////////////////////////
/////////////////enviar perido para corrientes///////////////////////////////////
app.post('/enviarpc', isAuthenticated, (req, res) => {
  const ExcelJS = require('exceljs');
  const fs = require('fs');
  const nodemailer = require('nodemailer');
  const user = req.user;
  const codcliente = user.codcliente;
  const tableNameCarrito = `carritocorrientes_${codcliente}`;
  const tableNameHistoricoCorrientes = `carritohistoricocorr_${codcliente}`;
  const db = mysql.createConnection(dbConfig);
  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end(); // Asegúrate de cerrar la conexión en caso de error
      return res.status(500).send('Error en el servidor');
    }
  // Realiza la lógica para obtener los datos del carrito de Corrientes
  const selectItemsSQL = `
    SELECT * FROM ${tableNameCarrito};
  `;

  db.query(selectItemsSQL, (err, result) => {
    if (err) {
      console.error('Error al obtener los elementos del carrito de Corrientes: ' + err.message);
      return res.status(500).send('Error en el servidor');
    }

    const carritoData = result; // Los datos del carrito de Corrientes

    // Inserta los datos del carrito en la tabla de historial de Corrientes
    const insertHistoricoSQL = `
      INSERT INTO ${tableNameHistoricoCorrientes} (fecha, codarticulo, descrip, cantidad, precio, total, observacion, codcliente)
      SELECT NOW(), codarticulo, descrip, cantidad, precio, total, observacion, ${codcliente}
      FROM ${tableNameCarrito};
    `;

    db.query(insertHistoricoSQL, (err) => {
      if (err) {
        console.error('Error al insertar datos en la tabla de historial de Corrientes: ' + err.message);
        return res.status(500).send('Error en el servidor');
      }

      // Crear un archivo Excel con los datos del carrito de Corrientes
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Pedido Corrientes');

      // Agrega los datos del carrito de Corrientes al archivo Excel
      worksheet.columns = [
        { header: 'Código de Artículo', key: 'codarticulo' },
        { header: 'Descripción', key: 'descrip' },
        { header: 'Cantidad', key: 'cantidad' },
        { header: 'observacion', key: 'observacion' },
        { header: 'codcliente', key: 'codcliente' },
        // Agrega más columnas según tus necesidades
      ];

      carritoData.forEach((item) => {
        worksheet.addRow({
          codarticulo: item.codarticulo,
          descrip: item.descrip,
          cantidad: item.cantidad,
          observacion: item.observacion,
          codcliente: item.codcliente,
          // Agrega más propiedades según las columnas que quieras incluir
        });
      });

      // Guarda el archivo Excel en un archivo temporal
      const excelFileName = 'pedido_corrientes.xlsx';
      const excelFilePath = `./temp/${excelFileName}`;

      workbook.xlsx.writeFile(excelFilePath)
        .then(() => {
          // Configura el transporte de correo electrónico con nodemailer
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: 'sebastian.autopartessolsrl@gmail.com',
              pass: 'ggnc ejkc amov pihv',
            },
          });

          // Configura el mensaje de correo electrónico
          const mailOptions = {
            from: 'sebastian.autopartessolsrl@gmail.com',
            to: user.email,
            subject: 'Pedido de Repuestos para Corrientes',
            text: req.body.comentario || 'Sin comentario adicional',
            attachments: [
              {
                filename: 'pedido_corrientes.xlsx',
                path: excelFilePath, // Utiliza el archivo Excel guardado
              },
            ],
          };

          // Envía el correo electrónico con nodemailer
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error('Error al enviar el correo electrónico: ' + error);
              return res.status(500).send('Error en el servidor');
            }

            console.log('Correo electrónico enviado a: ' + user.email);
            console.log('Mensaje: ' + req.body.comentario || 'Sin comentario adicional');
            console.log('Archivo adjunto: ' + excelFileName);

            // Borra el archivo temporal después de enviar el correo
            fs.unlinkSync(excelFilePath);

            // Borra los registros del carrito de Corrientes
            const deleteItemsSQL = `
              DELETE FROM ${tableNameCarrito};
            `;

            db.query(deleteItemsSQL, (err) => {
              if (err) {
                console.error('Error al borrar los elementos del carrito de Corrientes: ' + err.message);
                return res.status(500).send('Error en el servidor');
              }

              console.log('Registros del carrito de Corrientes eliminados con éxito');
              req.flash('success', 'Pedido enviado y carrito limpiado');
              db.end();
              // Envía una respuesta JSON al cliente indicando éxito
              res.redirect('/carritocorrientes');
            });
          });
        });
    });
  });
});
});
/////////////////////////////////////////////////////////////////////
/////////////////fin///////////////////////////////////
// Ruta para mostrar el historico de carritos
app.get('/historico', isAuthenticated, (req, res) => {
  const user = req.user;
  const codcliente = user.codcliente;
  const tableNameHistoricoMisiones = `carritohistoricomis_${codcliente}`;
  const tableNameHistoricoCorrientes = `carritohistoricocorr_${codcliente}`;
  const db = mysql.createConnection(dbConfig);
  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end(); // Asegúrate de cerrar la conexión en caso de error
      return res.status(500).send('Error en el servidor');
    }
  // Realiza la lógica para obtener los datos del historico de Misiones
  const selectHistoricoMisionesSQL = `
    SELECT * FROM ${tableNameHistoricoMisiones};
  `;

  // Realiza la lógica para obtener los datos del historico de Corrientes
  const selectHistoricoCorrientesSQL = `
    SELECT * FROM ${tableNameHistoricoCorrientes};
  `;

  db.query(selectHistoricoMisionesSQL, (errMisiones, resultMisiones) => {
    if (errMisiones) {
      console.error('Error al obtener los elementos del historico de Misiones: ' + errMisiones.message);
      return res.status(500).send('Error en el servidor');
    }

    db.query(selectHistoricoCorrientesSQL, (errCorrientes, resultCorrientes) => {
      if (errCorrientes) {
        console.error('Error al obtener los elementos del historico de Corrientes: ' + errCorrientes.message);
        return res.status(500).send('Error en el servidor');
      }
      db.end();
      // Renderiza la página historico.ejs y pasa los datos a la plantilla
      res.render('historico', {
        historicoMisiones: resultMisiones,
        historicoCorrientes: resultCorrientes,
      });
    });
  });
});
});

app.get('/descutil', isAuthenticated, (req, res) => {
  const user = req.user;
  const tableName = `fapro_${user.codcliente}`;
  const db = mysql.createConnection(dbConfig);
  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end(); // Asegúrate de cerrar la conexión en caso de error
      return res.status(500).send('Error en el servidor');
    }
  // Consulta SQL para obtener los datos de la tabla fapro+codcliente
  const selectDataSQL = `
      SELECT id, codproveedor, descripcion, descuento, utilidad
      FROM ${tableName};
  `;
  
  db.query(selectDataSQL, (err, results) => {
      if (err) {
          console.error('Error al obtener los datos: ' + err.message);
          return res.status(500).send('Error en el servidor');
      }
      db.end();
      res.render('descutil', { items: results });
  });
});
});
app.post('/guardarDescUtil', isAuthenticated, (req, res) => {
  const user = req.user;
  const tableName = `fapro_${user.codcliente}`;
  
  // Obtener los datos enviados por el usuario como arreglos
  const ids = req.body.id;
  const descuentos = req.body.descuento;
  const utilidades = req.body.utilidad;
  const db = mysql.createConnection(dbConfig);
  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end(); // Asegúrate de cerrar la conexión en caso de error
      return res.status(500).send('Error en el servidor');
    }
  // Iterar sobre los arreglos y actualizar la tabla
  for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const descuento = descuentos[i];
      const utilidad = utilidades[i];

      const updateDataSQL = `
          UPDATE ${tableName}
          SET descuento = ${descuento},
              utilidad = ${utilidad}
          WHERE id = ${id};
      `;

      db.query(updateDataSQL, (err) => {
          if (err) {
              console.error('Error al actualizar los datos: ' + err.message);
              return res.status(500).send('Error en el servidor');
          }
      });
  }
  db.end();
  // Redirigir de vuelta a la página de descutil o a donde prefieras
  res.redirect('/descutil');
});
});
// Ruta de cierre de sesión
app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/login'); // Redirige de nuevo a la página de inicio de sesión después de cerrar sesión
    db.end();
    console.log('conexion cerrada');
  });
});


// Estrategia de autenticación local con Passport
passport.use(
    new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
      console.log('Intento de inicio de sesión para el correo:', email);
      // Consulta a la base de datos para verificar las credenciales del usuario
      const db = mysql.createConnection(dbConfig);
      db.connect((err) => {
        if (err) {
          console.error('Error al conectar a la base de datos: ' + err.stack);
          db.end(); // Asegúrate de cerrar la conexión en caso de error
          return res.status(500).send('Error en el servidor');
        }
      db.query('SELECT * FROM facli WHERE email = ? AND password = ?', [email, password], (err, results) => {
        if (err) {
          return done(err);
        }
        if (!results || results.length === 0) {
          // En caso de usuario no encontrado, muestra mensaje flash de error
          return done(null, false, { message: 'Usuario no encontrado o contraseña incorrecta' });
        }
        const user = results[0];
        return done(null, user);
      });
    });
    })
  );

// Serialize y Deserialize para Passport
passport.serializeUser((user, done) => {
  done(null, user.codcliente);
});

passport.deserializeUser((id, done) => {
  const db = mysql.createConnection(dbConfig);
  db.connect((err) => {
    if (err) {
      console.error('Error al conectar a la base de datos: ' + err.stack);
      db.end(); // Asegúrate de cerrar la conexión en caso de error
      return res.status(500).send('Error en el servidor');
    }
  // Consulta a la base de datos para obtener el usuario por su ID
  db.query('SELECT * FROM facli WHERE codcliente = ?', [id], (err, results) => {
    if (err) {
      return done(err);
    }
    const user = results[0];
    done(null, user);
    db.end();
  });
});
});
const port = process.env.PORT || 3000; // Utiliza el puerto definido en las variables de entorno o el puerto 3000 por defecto

app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});