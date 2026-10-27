Add-Type -AssemblyName System.Drawing

function Create-BrandIcon {
    param(
        [int]$Size,
        [string]$Type = "squircle", # squircle, round, foreground, splash
        [string]$OutPath
    )

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $scale = $Size / 512.0

    if ($Type -eq "foreground") {
        $g.Clear([System.Drawing.Color]::Transparent)
    } elseif ($Type -eq "splash") {
        $g.Clear([System.Drawing.Color]::FromArgb(255, 11, 18, 32))
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
        # Background
        $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
            (New-Object System.Drawing.PointF 0, 0),
            (New-Object System.Drawing.PointF $Size, $Size),
            [System.Drawing.Color]::FromArgb(255, 11, 17, 32),
            [System.Drawing.Color]::FromArgb(255, 15, 23, 42)
        )

        if ($Type -eq "round") {
            $g.FillEllipse($bgBrush, 0, 0, $Size, $Size)
            $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 30, 41, 59), [Math]::Max(1.0, (4.0 * $scale)))
            $g.DrawEllipse($borderPen, (2.0 * $scale), (2.0 * $scale), ($Size - 4.0 * $scale), ($Size - 4.0 * $scale))
            $borderPen.Dispose()
        } else {
            # Squircle
            $rectPath = New-Object System.Drawing.Drawing2D.GraphicsPath
            $r = 110.0 * $scale
            $d = $r * 2.0
            $w = [float]$Size
            $h = [float]$Size
            $rectPath.AddArc(0, 0, $d, $d, 180, 90)
            $rectPath.AddArc(($w - $d), 0, $d, $d, 270, 90)
            $rectPath.AddArc(($w - $d), ($h - $d), $d, $d, 0, 90)
            $rectPath.AddArc(0, ($h - $d), $d, $d, 90, 90)
            $rectPath.CloseFigure()
            $g.FillPath($bgBrush, $rectPath)

            $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 30, 41, 59), [Math]::Max(1.0, (4.0 * $scale)))
            $g.DrawPath($borderPen, $rectPath)
            $borderPen.Dispose()
            $rectPath.Dispose()
        }
        $bgBrush.Dispose()
    }

    # Content transformation
    $contentMatrix = New-Object System.Drawing.Drawing2D.Matrix
    $contentMatrix.Scale($scale, $scale)

    if ($Type -eq "foreground") {
        # Safe zone for adaptive icon foreground: 66% diameter at center (256, 256)
        # Shift down slightly and scale so shield and weather glyph sit perfectly in the safe zone
        $contentMatrix.Translate(256, 256)
        $contentMatrix.Scale(0.85, 0.85)
        $contentMatrix.Translate(-256, -210)
    }

    $g.Transform = $contentMatrix

    # 1. Tech Shield Path
    $shieldPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $shieldPath.AddLine(256, 48, 372, 92)
    $shieldPath.AddLine(372, 92, 372, 185)
    $shieldPath.AddBezier(372, 185, 372, 257, 321, 296, 256, 314)
    $shieldPath.AddBezier(256, 314, 191, 296, 140, 257, 140, 185)
    $shieldPath.AddLine(140, 185, 140, 92)
    $shieldPath.CloseFigure()

    $shieldFill = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 15, 23, 42))
    $shieldPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 56, 189, 248), 9)
    $shieldPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    $g.FillPath($shieldFill, $shieldPath)
    $g.DrawPath($shieldPen, $shieldPath)
    $shieldFill.Dispose()
    $shieldPen.Dispose()
    $shieldPath.Dispose()

    # 2. Sun
    $sunBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF 249, 99),
        (New-Object System.Drawing.PointF 335, 185),
        [System.Drawing.Color]::FromArgb(255, 253, 224, 71),
        [System.Drawing.Color]::FromArgb(255, 249, 115, 22)
    )
    $g.FillEllipse($sunBrush, (292 - 43), (142 - 43), 86, 86)
    $sunBrush.Dispose()

    # 3. Cloud
    $cloudBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF 162, 140),
        (New-Object System.Drawing.PointF 321, 228),
        [System.Drawing.Color]::FromArgb(255, 56, 189, 248),
        [System.Drawing.Color]::FromArgb(255, 2, 132, 199)
    )
    $cloudPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $cloudPath.AddEllipse((195 - 32.5), (200 - 32.5), 65, 65)
    $cloudPath.AddEllipse((250 - 58), (170 - 58), 116, 116)
    $cloudPath.AddEllipse((295 - 40), (195 - 40), 80, 80)
    $cloudPath.AddRectangle((New-Object System.Drawing.RectangleF 180, 185, 125, 43))
    $g.FillPath($cloudBrush, $cloudPath)
    $cloudBrush.Dispose()
    $cloudPath.Dispose()

    # 4. Lightning
    $boltBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 250, 204, 21))
    $boltPoints = @(
        (New-Object System.Drawing.PointF 267, 181),
        (New-Object System.Drawing.PointF 231, 232),
        (New-Object System.Drawing.PointF 256, 232),
        (New-Object System.Drawing.PointF 242, 282),
        (New-Object System.Drawing.PointF 288, 217),
        (New-Object System.Drawing.PointF 260, 217)
    )
    $g.FillPolygon($boltBrush, $boltPoints)
    $boltBrush.Dispose()

    # 5. DFWMeteo Text & Accents (if not foreground)
    if ($Type -ne "foreground") {
        $fontBold = New-Object System.Drawing.Font("Segoe UI", 60, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $fontReg = New-Object System.Drawing.Font("Segoe UI", 60, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

        $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 248, 250, 252))
        $cyanBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 56, 189, 248))

        $sf = New-Object System.Drawing.StringFormat
        $sf.Alignment = [System.Drawing.StringAlignment]::Near
        $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

        $g.DrawString("DFW", $fontBold, $whiteBrush, 90, 400, $sf)
        $g.DrawString("Meteo", $fontReg, $cyanBrush, 230, 400, $sf)

        $fontBold.Dispose()
        $fontReg.Dispose()
        $whiteBrush.Dispose()
        $cyanBrush.Dispose()
        $sf.Dispose()

        $barOrange = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 245, 158, 11))
        $barCyan = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(180, 56, 189, 248))
        $g.FillRectangle($barOrange, 166, 434, 126, 8)
        $g.FillRectangle($barCyan, 306, 434, 40, 8)
        $barOrange.Dispose()
        $barCyan.Dispose()
    }

    $outDir = [System.IO.Path]::GetDirectoryName($OutPath)
    if (-not [System.IO.Directory]::Exists($outDir)) {
        [System.IO.Directory]::CreateDirectory($outDir) | Out-Null
    }

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    $contentMatrix.Dispose()
}

$densities = @(
    @{ name = "mdpi"; launcher = 48; foreground = 108 },
    @{ name = "hdpi"; launcher = 72; foreground = 162 },
    @{ name = "xhdpi"; launcher = 96; foreground = 216 },
    @{ name = "xxhdpi"; launcher = 144; foreground = 324 },
    @{ name = "xxxhdpi"; launcher = 192; foreground = 432 }
)

Write-Host "Generating Android mipmap icons..."
foreach ($d in $densities) {
    $folder = "android/app/src/main/res/mipmap-" + $d.name
    Create-BrandIcon -Size $d.launcher -Type "squircle" -OutPath ($folder + "/ic_launcher.png")
    Create-BrandIcon -Size $d.launcher -Type "round" -OutPath ($folder + "/ic_launcher_round.png")
    Create-BrandIcon -Size $d.foreground -Type "foreground" -OutPath ($folder + "/ic_launcher_foreground.png")
    Write-Host "Generated $folder"
}

Write-Host "Generating PWA icons..."
Create-BrandIcon -Size 192 -Type "squircle" -OutPath "public/icon-192.png"
Create-BrandIcon -Size 512 -Type "squircle" -OutPath "public/icon-512.png"

Write-Host "Generating Splash screens..."
Create-BrandIcon -Size 512 -Type "splash" -OutPath "android/app/src/main/res/drawable/splash.png"
$splashFolders = @(
    "drawable-port-mdpi", "drawable-port-hdpi", "drawable-port-xhdpi", "drawable-port-xxhdpi", "drawable-port-xxxhdpi",
    "drawable-land-mdpi", "drawable-land-hdpi", "drawable-land-xhdpi", "drawable-land-xxhdpi", "drawable-land-xxxhdpi"
)
foreach ($sf in $splashFolders) {
    $p = "android/app/src/main/res/" + $sf + "/splash.png"
    Copy-Item "android/app/src/main/res/drawable/splash.png" $p -Force
}

Write-Host "All icons generated successfully!"

