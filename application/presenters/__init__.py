"""
PRESENTERS - Output rendering layer

ConsolePresenter: stampa su terminale
GraphvizPresenter: genera output DOT
"""

from application.presenters.console_presenter import ConsolePresenter
from application.presenters.graphviz_presenter import GraphvizPresenter

__all__ = [
    "ConsolePresenter",
    "GraphvizPresenter",
]
