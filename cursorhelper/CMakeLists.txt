cmake_minimum_required(VERSION 3.20)
project(cursorhelper LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_AUTOMOC ON)

find_package(Qt6 REQUIRED COMPONENTS Quick Gui)

qt_add_library(cursorhelper SHARED plugin.cpp)
target_link_libraries(cursorhelper PRIVATE Qt6::Quick Qt6::Gui)

# Install to QML import path
set(QML_INSTALL_DIR "${CMAKE_INSTALL_PREFIX}/lib/qt6/qml/org/kde/plasma/cursorhelper"
    CACHE PATH "QML plugin install directory")

install(TARGETS cursorhelper DESTINATION ${QML_INSTALL_DIR})
install(FILES qmldir DESTINATION ${QML_INSTALL_DIR})
