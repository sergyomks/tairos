# Propuesta de Requisitos del Producto (PRP)
## ID del Proyecto: 59d6cb22-2136-4045-9e91-20af6417a46c

### Objetivo
El objetivo de este proyecto es diseñar y desarrollar una aplicación web que permita a los usuarios gestionar y visualizar información de manera eficiente. La aplicación debe ser escalable, segura y fácil de usar.

### Alcance
El alcance del proyecto incluye:

* Diseño y desarrollo de la aplicación web
* Creación de una base de datos para almacenar la información
* Implementación de una API para interactuar con la base de datos
* Diseño de la interfaz de usuario (UI) para una experiencia del usuario intuitiva
* Pruebas y depuración de la aplicación

### Stack Técnico
El stack técnico utilizado para este proyecto será:

* Lenguaje de programación: Python 3.9
* Framework web: Flask 2.0
* Base de datos: PostgreSQL 13
* Biblioteca de UI: React 17
* Servidor de aplicaciones: Gunicorn 20.1

### Tablas de DB
Las tablas de la base de datos serán las siguientes:

| Nombre de la tabla | Descripción |
| --- | --- |
| usuarios | Almacena la información de los usuarios |
| productos | Almacena la información de los productos |
| pedidos | Almacena la información de los pedidos |

Las columnas de cada tabla serán:

#### Usuarios
| Columna | Tipo de dato | Descripción |
| --- | --- | --- |
| id | integer | ID único del usuario |
| nombre | varchar(50) | Nombre del usuario |
| email | varchar(100) | Correo electrónico del usuario |
| contraseña | varchar(255) | Contraseña del usuario |

#### Productos
| Columna | Tipo de dato | Descripción |
| --- | --- | --- |
| id | integer | ID único del producto |
| nombre | varchar(50) | Nombre del producto |
| descripción | text | Descripción del producto |
| precio | decimal(10, 2) | Precio del producto |

#### Pedidos
| Columna | Tipo de dato | Descripción |
| --- | --- | --- |
| id | integer | ID único del pedido |
| id_usuario | integer | ID del usuario que realizó el pedido |
| id_producto | integer | ID del producto pedido |
| cantidad | integer | Cantidad de productos pedidos |
| fecha | date | Fecha en que se realizó el pedido |

### Endpoints API
Los siguientes endpoints API serán implementados:

* **GET /usuarios**: Obtiene la lista de todos los usuarios
* **GET /usuarios/{id}**: Obtiene la información de un usuario específico
* **POST /usuarios**: Crea un nuevo usuario
* **PUT /usuarios/{id}**: Actualiza la información de un usuario específico
* **DELETE /usuarios/{id}**: Elimina un usuario específico
* **GET /productos**: Obtiene la lista de todos los productos
* **GET /productos/{id}**: Obtiene la información de un producto específico
* **POST /productos**: Crea un nuevo producto
* **PUT /productos/{id}**: Actualiza la información de un producto específico
* **DELETE /productos/{id}**: Elimina un producto específico
* **GET /pedidos**: Obtiene la lista de todos los pedidos
* **GET /pedidos/{id}**: Obtiene la información de un pedido específico
* **POST /pedidos**: Crea un nuevo pedido
* **PUT /pedidos/{id}**: Actualiza la información de un pedido específico
* **DELETE /pedidos/{id}**: Elimina un pedido específico

### Componentes UI
Los siguientes componentes UI serán diseñados:

* **Barra de navegación**: Permite al usuario navegar entre las diferentes secciones de la aplicación
* **Formulario de login**: Permite al usuario ingresar a la aplicación
* **Formulario de registro**: Permite al usuario crear una cuenta
* **Lista de productos**: Muestra la lista de todos los productos
* **Detalle de producto**: Muestra la información de un producto específico
* **Formulario de pedido**: Permite al usuario realizar un pedido

### Criterios de Aceptación
Los siguientes criterios de aceptación serán utilizados para evaluar la aplicación:

* La aplicación debe ser capaz de autenticar y autorizar a los usuarios
* La aplicación debe ser capaz de crear, leer, actualizar y eliminar usuarios, productos y pedidos
* La aplicación debe ser capaz de mostrar la lista de todos los productos y pedidos
* La aplicación debe ser capaz de mostrar la información de un producto y pedido específico
* La aplicación debe ser capaz de realizar pedidos y actualizar la cantidad de productos en stock
* La aplicación debe ser capaz de manejar errores y excepciones de manera adecuada
* La aplicación debe ser capaz de ser escalada y desplegada en un entorno de producción

La aplicación debe cumplir con los siguientes estándares de calidad:

* La aplicación debe ser segura y proteger la información de los usuarios
* La aplicación debe ser eficiente y responder rápidamente a las solicitudes de los usuarios
* La aplicación debe ser fácil de usar y navegar
* La aplicación debe ser compatible con diferentes navegadores y dispositivos

La aplicación debe ser evaluada y probada de manera exhaustiva para asegurarse de que cumple con los criterios de aceptación y los estándares de calidad.