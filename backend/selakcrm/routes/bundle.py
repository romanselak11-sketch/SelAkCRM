from fastapi import APIRouter

from selakcrm.routes import (
    analytics_audit_routes,
    auth_routes,
    clients_routes,
    health_setup,
    home_routes,
    insurance_routes,
    license_routes,
    me_routes,
    policies_routes,
    role_permissions_routes,
    users_routes,
)


def build_api_router() -> APIRouter:
    r = APIRouter(prefix="/api/v1")
    r.include_router(health_setup.router)
    r.include_router(license_routes.router)
    r.include_router(auth_routes.router)
    r.include_router(me_routes.router)
    r.include_router(users_routes.router)
    r.include_router(role_permissions_routes.router)
    r.include_router(insurance_routes.router)
    r.include_router(clients_routes.router)
    r.include_router(policies_routes.router)
    r.include_router(home_routes.router)
    r.include_router(analytics_audit_routes.router_analytics)
    r.include_router(analytics_audit_routes.router_audit)
    return r
