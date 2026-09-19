cmake_minimum_required(VERSION 3.16)
project(ClipFlowHelper VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

find_package(Qt6 REQUIRED COMPONENTS Core Gui Widgets Network)

set(SOURCES
    src/main.cpp
    src/ui/FloatingWidget.h
    src/ui/FloatingWidget.cpp
    src/core/DependencyManager.h
    src/core/DependencyManager.cpp
    src/core/DownloadManager.h
    src/core/DownloadManager.cpp
    src/core/LocalServer.h
    src/core/LocalServer.cpp
    src/updater/AutoUpdater.h
    src/updater/AutoUpdater.cpp
    resources.qrc
)

add_executable(ClipFlowHelper ${SOURCES})

target_include_directories(ClipFlowHelper PRIVATE
    src
    src/ui
    src/core
    src/updater
)

target_link_libraries(ClipFlowHelper PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Widgets
    Qt6::Network
)

if (WIN32)
    # Allows terminal output for inspection while running
    set_target_properties(ClipFlowHelper PROPERTIES
        OUTPUT_NAME "ClipFlowHelper"
    )
endif()
