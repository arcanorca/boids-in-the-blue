import QtQuick

Item {
    id: root
    x: 0
    y: 0
    width: 1
    height: 1
    
    // Logic properties
    property var spriteData: []
    property string colorString: "#FFFFFF"
    property bool flip: false
    property double size: 1.0
    property int type: 0 // 1=Fish, 2=Jelly, etc

    Component.onCompleted: {
        // console.log("Delegate Created: " + type);
    }
    
    // Smoothing

    Behavior on x { NumberAnimation { duration: 60; easing.type: Easing.OutQuad } }
    Behavior on y { NumberAnimation { duration: 60; easing.type: Easing.OutQuad } }


    // Turn/Flip Animation
    transform: Scale { 
        origin.x: width / 2
        xScale: root.flip ? -1 : 1 
    }





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
            var w = s + 0.4;
            var h = s + 0.4;

            // Pass 1: Primary Color
            ctx.beginPath();
            var has1 = false;
            for (var r = 0; r < rows; r++) {
                for (var c = 0; c < cols; c++) {
                    if (root.spriteData[r][c] === 1) {
                        // Drawing normally (no flip in canvas, handled by Scale)
                        var px = c * s; 
                        var py = r * s;
                        ctx.rect(px, py, w, h);
                        has1 = true;
                    }
                }
            }
            if (has1) {
                ctx.fillStyle = root.colorString;
                ctx.fill();
            }

            // Pass 2: Secondary Color
            ctx.beginPath();
            var has2 = false;
            for (var r = 0; r < rows; r++) {
                for (var c = 0; c < cols; c++) {
                    if (root.spriteData[r][c] === 2) {
                        var px = c * s;
                        var py = r * s;
                        ctx.rect(px, py, w, h);
                        has2 = true;
                    }
                }
            }
            if (has2) {
                var col2 = null;
                if (root.type === 1) col2 = "#FFFFFF"; // Fish Eye
                if (root.type === 4) col2 = "#FFFF99"; // Angler light
                if (root.type === 3) col2 = "#E6E6E6"; // Orca belly
                if (root.type === 2) col2 = root.colorString; // Jelly: Same as body (transparent)
                
                if (col2) {
                    ctx.fillStyle = col2;
                    ctx.fill();
                }
            }
            
            // Pass 3: Tertiary Color
            ctx.beginPath();
            var has3 = false;
            for (var r = 0; r < rows; r++) {
                for (var c = 0; c < cols; c++) {
                    if (root.spriteData[r][c] === 3) {
                        var px = c * s;
                        var py = r * s;
                        ctx.rect(px, py, w, h);
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
    
    // Repaint check
    onSpriteDataChanged: spriteCanvas.requestPaint()
    onColorStringChanged: spriteCanvas.requestPaint()
    onSizeChanged: spriteCanvas.requestPaint()
    // Flip handled by Transform, no repaint needed!
}
