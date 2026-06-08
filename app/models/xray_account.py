from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class Account(BaseModel):
    email: str
    level: int = 0

    @property
    def message(self):
        raise RuntimeError("Python Xray protobuf account messages are not available in Go-native runtime mode")


class VMessAccount(Account):
    id: UUID


class XTLSFlows(str, Enum):
    NONE = ""
    VISION = "xtls-rprx-vision"


class VLESSAccount(Account):
    id: UUID
    flow: XTLSFlows = XTLSFlows.NONE


class TrojanAccount(Account):
    password: str
    flow: XTLSFlows = XTLSFlows.NONE


class ShadowsocksMethods(str, Enum):
    AES_128_GCM = "aes-128-gcm"
    AES_256_GCM = "aes-256-gcm"
    CHACHA20_POLY1305 = "chacha20-ietf-poly1305"
    XCHACHA20_POLY1305 = "xchacha20-ietf-poly1305"
    BLAKE3_AES_128_GCM = "2022-blake3-aes-128-gcm"
    BLAKE3_AES_256_GCM = "2022-blake3-aes-256-gcm"
    BLAKE3_CHACHA20_POLY1305 = "2022-blake3-chacha20-poly1305"


class ShadowsocksAccount(Account):
    password: str
    method: ShadowsocksMethods = ShadowsocksMethods.CHACHA20_POLY1305
    iv_check: bool = False
