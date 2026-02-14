import QtQuick

Item {
    id: root
    x: 0
    y: 0
    width: 1
    height: 1

    property var spriteData: []
    property string colorString: "#FFFFFF"
    property bool flip: false
    property double size: 1.0
    property int type: 0
    property double shakeX: 0
    property double shakeY: 0

    Behavior on x { NumberAnimation { duration: 40; easing.type: Easing.Linear } }
    Behavior on y { NumberAnimation { duration: 40; easing.type: Easing.Linear } }

    transform: [
        Translate { x: root.shakeX; y: root.shakeY },
        Scale { origin.x: width / 2; xScale: root.flip ? -1 : 1 }
    ]

    Canvas {
        id: spriteCanvas
        anchors.centerIn: parent
        width: Math.max(1, root.spriteData[0] ? root.spriteData[0].length * root.size : 10)
        height: Math.max(1, root.spriteData.length * root.size)

        onPaint: {
            var ctx = getContext("2d");
            ctx.clearRect(0, 0, width, height);

            if (!root.spriteData || root.spriteData.length === 0) return;

            var rows = root.spriteData.length;
            var cols = root.spriteData[0].length;
            var s = root.size;
            var w = s + 1.0;
            var h = s + 1.0;

            ctx.beginPath();
            var has1 = false;
            for (var r = 0; r < rows; r++) {
                for (var c = 0; c < cols; c++) {
                    if (root.spriteData[r][c] === 1) {
                        ctx.rect(c * s, r * s, w, h);
                        has1 = true;
                    }
                }
            }
            if (has1) {
                ctx.fillStyle = root.colorString;
                ctx.fill();
            }

            ctx.beginPath();
            var has2 = false;
            for (var r = 0; r < rows; r++) {
                for (var c = 0; c < cols; c++) {
                    if (root.spriteData[r][c] === 2) {
                        ctx.rect(c * s, r * s, w, h);
                        has2 = true;
                    }
                }
            }
            if (has2) {
                var col2 = null;
                if (root.type === 1) col2 = "#FFFFFF";
                if (root.type === 4) col2 = "#FFFF99";
                if (root.type === 3) col2 = "#E6E6E6";
                if (root.type === 2) col2 = root.colorString;

                if (col2) {
                    ctx.fillStyle = col2;
                    ctx.fill();
                }
            }

            ctx.beginPath();
            var has3 = false;
            for (var r = 0; r < rows; r++) {
                for (var c = 0; c < cols; c++) {
                    if (root.spriteData[r][c] === 3) {
                        ctx.rect(c * s, r * s, w, h);
                        has3 = true;
                    }
                }
            }
            if (has3) {
                ctx.fillStyle = "#FF3333";
                ctx.fill();
            }
        }
    }

    onSpriteDataChanged: spriteCanvas.requestPaint()
    onColorStringChanged: spriteCanvas.requestPaint()
    onSizeChanged: spriteCanvas.requestPaint()
}
