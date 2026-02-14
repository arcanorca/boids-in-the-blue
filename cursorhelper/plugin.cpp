#include <QQmlExtensionPlugin>
#include <QQmlEngine>
#include <QCursor>
#include <QObject>
#include <QPointF>

class CursorHelper : public QObject
{
    Q_OBJECT
public:
    explicit CursorHelper(QObject *parent = nullptr) : QObject(parent) {}
    Q_INVOKABLE QPointF pos() const { return QCursor::pos(); }
};

class CursorHelperPlugin : public QQmlExtensionPlugin
{
    Q_OBJECT
    Q_PLUGIN_METADATA(IID QQmlExtensionInterface_iid)
public:
    void registerTypes(const char *uri) override {
        qmlRegisterSingletonType<CursorHelper>(uri, 1, 0, "Cursor",
            [](QQmlEngine *, QJSEngine *) -> QObject * {
                return new CursorHelper();
            });
    }
};

#include "plugin.moc"
