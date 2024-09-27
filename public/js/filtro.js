// Agrega un controlador de eventos al contenedor .grid-container
document.querySelector('.grid-container').addEventListener('click', function(event) {
    // Verifica si el clic se realizó en un botón de "Misiones"
    if (event.target.classList.contains('carrito-btn') && event.target.getAttribute('data-carrito') === 'misiones') {
        // Manejar el clic en el botón de "Misiones"
        const codarticulo = event.target.getAttribute('data-codarticulo');
        const cantidad = event.target.parentElement.querySelector('[name="cantidad"]').value;
        const carrito = 'misiones'; // Aquí define el tipo de carrito, en este caso "misiones"

        // Realizar una solicitud AJAX para cargar el artículo en el carrito
        fetch('/cargarCarrito', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                codarticulo: codarticulo,
                cantidad: cantidad,
                carrito: carrito
            })
        })
        .then(response => response.text())
        .then(data => {
            // Manejar la respuesta, por ejemplo, mostrar un mensaje de éxito
            console.log(data);
            // Puedes hacer aquí lo que necesites con la respuesta del servidor
            // Mostrar el mensaje de "Cargado al carrito"
            const mensajeCarrito = document.getElementById('mensajeCarrito');
            mensajeCarrito.style.display = 'block';

            // Limpiar el campo de cantidad
            event.target.parentElement.querySelector('[name="cantidad"]').value = '';

            // Ocultar el mensaje después de unos segundos (por ejemplo, 3 segundos)
            setTimeout(() => {
                mensajeCarrito.style.display = 'none';
            }, 3000); // 3000 milisegundos = 3 segundos
        })
        .catch(error => {
            // Manejar errores, por ejemplo, mostrar un mensaje de error
            console.error('Error al cargar el carrito: ' + error);
        });
    } else if (event.target.classList.contains('carrito-btn') && event.target.getAttribute('data-carrito') === 'corrientes') {
        // Manejar el clic en el botón de "Corrientes"
        const codarticulo = event.target.getAttribute('data-codarticulo');
        const cantidad = event.target.parentElement.querySelector('[name="cantidad"]').value;
        const carrito = 'corrientes'; // Aquí define el tipo de carrito, en este caso "corrientes"

        // Realizar una solicitud AJAX para cargar el artículo en el carrito (similar al bloque anterior)
        fetch('/cargarCarrito', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                codarticulo: codarticulo,
                cantidad: cantidad,
                carrito: carrito
            })
        })
        .then(response => response.text())
        .then(data => {
            // Manejar la respuesta, por ejemplo, mostrar un mensaje de éxito
            console.log(data);
            // Mostrar el mensaje de "Cargado al carrito"
            const mensajeCarrito = document.getElementById('mensajeCarrito');
            mensajeCarrito.style.display = 'block';
            // Limpiar el campo de cantidad
            event.target.parentElement.querySelector('[name="cantidad"]').value = '';
            
            // Ocultar el mensaje después de unos segundos (por ejemplo, 3 segundos)
            setTimeout(() => {
                mensajeCarrito.style.display = 'none';
            }, 2000); // 3000 milisegundos = 3 segundos
        })

      
        .catch(error => {
            // Manejar errores, por ejemplo, mostrar un mensaje de error
            console.error('Error al cargar el carritoSEBA: ' + error);
        });
    }
});
  

// Esta función maneja el evento de clic en las imágenes
function handleImageClick() {
    // Cambia la clase de la imagen al hacer clic
    this.classList.toggle('enlarged');
}

// Agrega un evento de clic a todas las imágenes existentes
const existingImages = document.querySelectorAll('.articulo-imagen');
existingImages.forEach((img) => {
    img.addEventListener('click', handleImageClick);
});

// Agrega un evento de clic a las imágenes generadas dinámicamente
// Esto se hace después de hacer clic en el botón "Aplicar filtro"
function addClickEventToDynamicImages() {
    const dynamicImages = document.querySelectorAll('.articulo-imagen:not(.enlarged)');
    dynamicImages.forEach((img) => {
        img.addEventListener('click', handleImageClick);
    });
}

// Agrega eventos para mostrar y ocultar el tooltip al pasar el mouse
document.addEventListener('DOMContentLoaded', function () {
    const tooltips = document.querySelectorAll('.tooltip-container');

    tooltips.forEach((tooltip, index) => {
        const tooltipId = `tooltip${index}`;
        const currentTooltip = document.getElementById(tooltipId);

        tooltip.addEventListener('mouseover', function () {
            currentTooltip.style.visibility = 'visible';
        });

        tooltip.addEventListener('mouseout', function () {
            currentTooltip.style.visibility = 'hidden';
        });
    });
});

