"""
SNAPSHOT REPOSITORY - Persistenza degli snapshot di rete

Repository per salvare e caricare NetworkSnapshot su disco.
Usa Pickle per serializzazione efficiente dei modelli Pydantic.

Uso:
    repository = SnapshotRepository()

    # Salvataggio
    repository.save(snapshot, Path("network.snapshot"))

    # Caricamento
    snapshot = repository.load(Path("network.snapshot"))

    # Verifica esistenza
    if repository.exists(Path("network.snapshot")):
        ...
"""

from __future__ import annotations
import pickle
import gzip
import logging
from pathlib import Path
import traceback
from typing import Optional

from application.models.snapshot import NetworkSnapshot


logger = logging.getLogger(__name__)


class SnapshotRepositoryError(Exception):
    """Eccezione base per errori del repository."""
    pass


class SnapshotNotFoundError(SnapshotRepositoryError):
    """Lo snapshot richiesto non esiste."""
    pass


class SnapshotCorruptedError(SnapshotRepositoryError):
    """Lo snapshot e' corrotto o non leggibile."""
    pass


class SnapshotVersionError(SnapshotRepositoryError):
    """Versione dello snapshot non compatibile."""
    pass


class SnapshotRepository:
    """
    Repository per la persistenza degli snapshot di rete.

    Caratteristiche:
    - Serializzazione con Pickle (efficiente per oggetti Python)
    - Compressione opzionale con gzip
    - Validazione versione al caricamento
    - Gestione errori robusta

    Formato file:
    - .snapshot: Pickle non compresso
    - .snapshot.gz: Pickle compresso con gzip
    """

    SUPPORTED_VERSIONS = ["1.0"]
    DEFAULT_EXTENSION = ".snapshot"
    COMPRESSED_EXTENSION = ".snapshot.gz"

    def __init__(self, compress: bool = True) -> None:
        """
        Inizializza il repository.

        Args:
            compress: Se True, comprime gli snapshot con gzip (default True)
        """
        self.compress = compress

    def save(
        self,
        snapshot: NetworkSnapshot,
        path: Path,
        overwrite: bool = True,
    ) -> Path:
        """
        Salva uno snapshot su disco.

        Args:
            snapshot: NetworkSnapshot da salvare
            path: Path di destinazione (senza estensione)
            overwrite: Se True, sovrascrive file esistente

        Returns:
            Path completo del file salvato

        Raises:
            SnapshotRepositoryError: Se il salvataggio fallisce
            FileExistsError: Se il file esiste e overwrite=False
        """
        # Normalizza path
        path = Path(path)
        if not path.suffix:
            path = path.with_suffix(
                self.COMPRESSED_EXTENSION if self.compress else self.DEFAULT_EXTENSION
            )

        # Check overwrite
        if path.exists() and not overwrite:
            raise FileExistsError(f"Snapshot gia' esistente: {path}")

        # Crea directory se necessario
        path.parent.mkdir(parents=True, exist_ok=True)

        try:
            # Serializza con Pydantic
            data = snapshot.model_dump(mode="python")

            # Salva
            if self.compress or path.suffix == self.COMPRESSED_EXTENSION:
                with gzip.open(path, "wb") as f:
                    pickle.dump(data, f, protocol=pickle.HIGHEST_PROTOCOL)
            else:
                with open(path, "wb") as f:
                    pickle.dump(data, f, protocol=pickle.HIGHEST_PROTOCOL)

            logger.info(
                f"Snapshot salvato: {path} "
                f"({path.stat().st_size / 1024:.1f} KB)"
            )

            return path

        except Exception as e:
            logger.error(f"Errore salvataggio snapshot: {e}")
            raise SnapshotRepositoryError(f"Impossibile salvare snapshot: {e}") from e

    def load(self, path: Path) -> NetworkSnapshot:
        """
        Carica uno snapshot da disco.

        Args:
            path: Path del file snapshot

        Returns:
            NetworkSnapshot caricato

        Raises:
            SnapshotNotFoundError: Se il file non esiste
            SnapshotCorruptedError: Se il file e' corrotto
            SnapshotVersionError: Se la versione non e' supportata
        """
        path = Path(path)

        # Prova con estensioni se non specificata
        if not path.exists():
            for ext in [self.COMPRESSED_EXTENSION, self.DEFAULT_EXTENSION]:
                alt_path = path.with_suffix(ext)
                if alt_path.exists():
                    path = alt_path
                    break

        if not path.exists():
            raise SnapshotNotFoundError(f"Snapshot non trovato: {path}")

        try:
            # Carica (auto-detect gzip anche se estensione e' .snapshot)
            is_compressed = self._is_gzip_file(path) or path.suffix == ".gz" or path.suffixes == [".snapshot", ".gz"]

            if is_compressed:
                with gzip.open(path, "rb") as f:
                    data = pickle.load(f)
            else:
                with open(path, "rb") as f:
                    data = pickle.load(f)

            # Ricostruisci modello
            snapshot = NetworkSnapshot.model_validate(data)

            # Valida versione
            if snapshot.version not in self.SUPPORTED_VERSIONS:
                raise SnapshotVersionError(
                    f"Versione snapshot {snapshot.version} non supportata. "
                    f"Versioni supportate: {self.SUPPORTED_VERSIONS}"
                )

            logger.info(
                f"Snapshot caricato: {path} "
                f"(nodes={snapshot.total_nodes}, "
                f"routes={snapshot.total_routes}, "
                f"age={snapshot.age_human})"
            )

            return snapshot

        except (pickle.UnpicklingError, EOFError, gzip.BadGzipFile) as e:
            logger.error(f"Snapshot corrotto: {path}")
            import traceback
            traceback.print_exc()
            raise SnapshotCorruptedError(f"Snapshot corrotto: {e}") from e

        except SnapshotVersionError:
            raise

        except Exception as e:
            logger.error(f"Errore caricamento snapshot: {e}")
            raise SnapshotRepositoryError(f"Impossibile caricare snapshot: {e}") from e

    def exists(self, path: Path) -> bool:
        """
        Verifica se uno snapshot esiste.

        Args:
            path: Path del file (con o senza estensione)

        Returns:
            True se esiste, False altrimenti
        """
        path = Path(path)

        if path.exists():
            return True

        # Prova con estensioni
        for ext in [self.COMPRESSED_EXTENSION, self.DEFAULT_EXTENSION]:
            if path.with_suffix(ext).exists():
                return True

        return False

    def get_info(self, path: Path) -> Optional[dict]:
        """
        Ottiene informazioni su uno snapshot senza caricarlo completamente.

        Args:
            path: Path del file snapshot

        Returns:
            Dict con info base o None se non esiste
        """
        path = Path(path)

        if not self.exists(path):
            return None

        try:
            snapshot = self.load(path)
            return {
                "path": str(path),
                "version": snapshot.version,
                "timestamp": snapshot.timestamp.isoformat(),
                "age": snapshot.age_human,
                "nodes": snapshot.total_nodes,
                "links": snapshot.total_links,
                "routes": snapshot.total_routes,
                "interfaces": snapshot.total_interfaces,
                "firewalls": snapshot.firewalls_count,
                "size_kb": path.stat().st_size / 1024,
            }
        except Exception as e:
            logger.warning(f"Impossibile leggere info snapshot: {e}")
            return None

    def list_snapshots(self, directory: Path) -> list[dict]:
        """
        Elenca tutti gli snapshot in una directory.

        Args:
            directory: Directory da scansionare

        Returns:
            Lista di dict con info per ogni snapshot
        """
        directory = Path(directory)
        snapshots = []

        if not directory.exists():
            return snapshots

        for ext in [self.DEFAULT_EXTENSION, self.COMPRESSED_EXTENSION]:
            for file_path in directory.glob(f"*{ext}"):
                info = self.get_info(file_path)
                if info:
                    snapshots.append(info)

        # Ordina per timestamp (piu' recente prima)
        snapshots.sort(key=lambda x: x["timestamp"], reverse=True)

        return snapshots

    def delete(self, path: Path) -> bool:
        """
        Elimina uno snapshot.

        Args:
            path: Path del file snapshot

        Returns:
            True se eliminato, False se non esisteva
        """
        path = Path(path)

        # Trova il file effettivo
        actual_path = None
        if path.exists():
            actual_path = path
        else:
            for ext in [self.COMPRESSED_EXTENSION, self.DEFAULT_EXTENSION]:
                alt_path = path.with_suffix(ext)
                if alt_path.exists():
                    actual_path = alt_path
                    break

        if actual_path is None:
            return False

        actual_path.unlink()
        logger.info(f"Snapshot eliminato: {actual_path}")
        return True

    @staticmethod
    def _is_gzip_file(path: Path) -> bool:
        """
        Rileva gzip tramite magic bytes (1F 8B).
        Utile quando il file e' compresso ma ha estensione .snapshot.
        """
        try:
            with open(path, "rb") as f:
                return f.read(2) == b"\x1f\x8b"
        except OSError:
            return False
