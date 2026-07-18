# Manchas AI

Manchas AI es un asistente inteligente SaaS para peluquerías, barberías y salones de belleza.

El sistema permitirá gestionar negocios, usuarios, clientes, peluqueros, servicios, citas, inventario, ventas, reportes y atención automatizada mediante inteligencia artificial y WhatsApp.

## Objetivo del MVP

La primera versión permitirá:

- Registrar una peluquería.
- Crear un usuario administrador.
- Iniciar sesión.
- Gestionar clientes.
- Gestionar peluqueros.
- Gestionar servicios.
- Agendar, cancelar y reprogramar citas.
- Consultar la agenda.
- Evitar reservas duplicadas.
- Separar los datos de cada negocio.

## Tecnologías

### Backend

- Python
- FastAPI
- SQLAlchemy
- PostgreSQL
- JWT

### Frontend

- React
- Vite
- JavaScript

### Infraestructura futura

- Docker
- Nginx
- WhatsApp Business API
- Inteligencia artificial

## Arquitectura SaaS

Manchas AI utilizará una arquitectura multi-tenant. Cada negocio tendrá sus propios usuarios, clientes, servicios, peluqueros y citas.

Los datos se separarán mediante el campo `business_id`.

## Estado del proyecto

Proyecto en desarrollo.