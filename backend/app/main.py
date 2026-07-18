from fastapi import FastAPI

app = FastAPI(
    title="Manchas AI API",
    description=(
        "API del asistente inteligente SaaS para peluquerías, "
        "barberías y salones de belleza."
    ),
    version="0.1.0",
)


@app.get("/", tags=["General"])
def root():
    return {
        "message": "Bienvenido a Manchas AI",
        "status": "online",
        "version": "0.1.0",
    }


@app.get("/health", tags=["General"])
def health_check():
    return {
        "status": "healthy",
        "service": "Manchas AI API",
    }