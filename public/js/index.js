// index.js

document.addEventListener('DOMContentLoaded', function () {
    // Función para mostrar la oferta en el carrusel
    function mostrarOferta(oferta) {
        const ofertaCarousel = document.querySelector('.carousel');

        // Limpiar el carrusel antes de agregar los nuevos artículos
        ofertaCarousel.innerHTML = '';

        // Recorrer todos los artículos de la oferta y agregarlos al carrusel
        oferta.forEach(item => {
            const ofertaItem = document.createElement('div');
            ofertaItem.classList.add('oferta-item');
            ofertaItem.innerHTML = `
                <img src="/imagenes/${item.nombreimagen}.jpg" alt="" class="articulo-imagen" data-enlarge="false" loading="lazy">
                <p><strong>Código de Artículo:</strong><span style="color: orange;"> ${item.codarticulo}</p>
                <p><strong>Descripción:</strong><span style="color: orange;"> ${item.descrip}</p>
                <p><strong>Precio Oferta:</strong><span style="color: orange;"> ${item.precio}</p>
                <p><strong>Comprando la Cantidad:</strong><span style="color: orange;"> ${item.cantidad}</p>
            `;
            ofertaCarousel.appendChild(ofertaItem);
        });

        // Inicializar el carrusel después de cargar los nuevos elementos
        $('.carousel').slick({
            slidesToShow: 4, // Número de elementos visibles al mismo tiempo
            slidesToScroll: 1,
            prevArrow: $('.carousel-prev'),
            nextArrow: $('.carousel-next'),
            responsive: [
                {
                    breakpoint: 768,
                    settings: {
                        slidesToShow: 2
                    }
                },
                {
                    breakpoint: 480,
                    settings: {
                        slidesToShow: 1
                    }
                }
            ]
        });
    }

    // Función para verificar la oferta al cargar la página
    function verificarOferta() {
        fetch('/obtenerOferta')
            .then(response => response.json())
            .then(data => {
                if (data.ofertaVigente) {
                    mostrarOferta(data.ofertas);
                }
            })
            .catch(error => console.error('Error al obtener oferta:', error));
    }

    // Verificar si hay una oferta al cargar la página
    verificarOferta();

    // Eventos click para los botones de navegación
    $('.carousel-prev').click(function(){
        $('.carousel').slick('slickPrev');
    });

    $('.carousel-next').click(function(){
        $('.carousel').slick('slickNext');
    });
});
