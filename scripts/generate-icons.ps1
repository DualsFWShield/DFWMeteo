Add-Type -AssemblyName PresentationCore, PresentationFramework, WindowsBase

function Export-DfwIcon {
    param(
        [int]$TargetSize,
        [string]$Type = "squircle", # squircle, round, foreground, splash
        [string]$OutFile
    )

    $visual = New-Object System.Windows.Media.DrawingVisual
    $dc = $visual.RenderOpen()

    $scale = $TargetSize / 512.0
    $transform = New-Object System.Windows.Media.TransformGroup
    $transform.Children.Add((New-Object System.Windows.Media.ScaleTransform($scale, $scale)))

    $dc.PushTransform($transform)

    # 1. Background (if not foreground)
    if ($Type -ne "foreground") {
        $bgBrush = New-Object System.Windows.Media.LinearGradientBrush(
            [System.Windows.Media.Color]::FromRgb(0x0b, 0x11, 0x20),
            [System.Windows.Media.Color]::FromRgb(0x0f, 0x17, 0x2a),
            (New-Object System.Windows.Point(0, 0)),
            (New-Object System.Windows.Point(1, 1))
        )
        $borderPen = New-Object System.Windows.Media.Pen(
            (New-Object System.Windows.Media.SolidColorBrush([System.Windows.Media.Color]::FromRgb(0x1e, 0x29, 0x3b))),
            6.0
        )

        if ($Type -eq "round") {
            $dc.DrawEllipse($bgBrush, $borderPen, (New-Object System.Windows.Point(256, 256)), 253, 253)
        } elseif ($Type -eq "splash") {
            $splashBg = New-Object System.Windows.Media.SolidColorBrush([System.Windows.Media.Color]::FromRgb(0x07, 0x0b, 0x14))
            $dc.DrawRectangle($splashBg, $null, (New-Object System.Windows.Rect(0, 0, 512, 512)))
        } else {
            # Squircle: rect with rx=110
            $dc.DrawRoundedRectangle($bgBrush, $borderPen, (New-Object System.Windows.Rect(3, 3, 506, 506)), 110, 110)
        }
    }

    # Transform for content
    if ($Type -eq "foreground") {
        $fgGroup = New-Object System.Windows.Media.TransformGroup
        # Center shield (Y: 48..314, mid=181 -> shift to 256, so +75)
        $fgGroup.Children.Add((New-Object System.Windows.Media.TranslateTransform(0, 75)))
        # Scale to 0.95 inside safe area
        $fgGroup.Children.Add((New-Object System.Windows.Media.ScaleTransform(0.95, 0.95, 256, 256)))
        $dc.PushTransform($fgGroup)
    }

    # 2. Tech Shield Base
    $shieldBrush = New-Object System.Windows.Media.SolidColorBrush([System.Windows.Media.Color]::FromRgb(0x0f, 0x17, 0x2a))
    $shieldPen = New-Object System.Windows.Media.Pen(
        (New-Object System.Windows.Media.SolidColorBrush([System.Windows.Media.Color]::FromRgb(0x38, 0xbd, 0xf8))),
        9.0
    )
    $shieldPen.LineJoin = [System.Windows.Media.PenLineJoin]::Round
    $shieldGeo = [System.Windows.Media.Geometry]::Parse("M 256 48 L 372 92 V 185 C 372 257 321 296 256 314 C 191 296 140 257 140 185 V 92 Z")
    $dc.DrawGeometry($shieldBrush, $null, $shieldGeo)

    # Push clip so weather glyphs can never spill outside the shield frame
    $dc.PushClip($shieldGeo)

    # 3. Sun
    $sunBrush = New-Object System.Windows.Media.LinearGradientBrush(
        [System.Windows.Media.Color]::FromRgb(0xfd, 0xe0, 0x47),
        [System.Windows.Media.Color]::FromRgb(0xf9, 0x73, 0x16),
        (New-Object System.Windows.Point(0, 0)),
        (New-Object System.Windows.Point(1, 1))
    )
    $sunGeo = New-Object System.Windows.Media.EllipseGeometry((New-Object System.Windows.Point(292, 142)), 43, 43)
    $dc.DrawGeometry($sunBrush, $null, $sunGeo)

    # 4. Signature Cloud (Exact SVG geometry)
    $cloudBrush = New-Object System.Windows.Media.LinearGradientBrush(
        [System.Windows.Media.Color]::FromRgb(0x38, 0xbd, 0xf8),
        [System.Windows.Media.Color]::FromRgb(0x02, 0x84, 0xc7),
        (New-Object System.Windows.Point(0, 0)),
        (New-Object System.Windows.Point(1, 1))
    )
    $cloudGeo = [System.Windows.Media.Geometry]::Parse("M 195 228 A 32.5 32.5 0 0 1 195 163 A 58 58 0 0 1 306 149 A 40 40 0 0 1 321 228 Z")
    $dc.DrawGeometry($cloudBrush, $null, $cloudGeo)

    # 5. Lightning Bolt
    $boltBrush = New-Object System.Windows.Media.SolidColorBrush([System.Windows.Media.Color]::FromRgb(0xfa, 0xcc, 0x15))
    $boltGeo = [System.Windows.Media.Geometry]::Parse("M 267 181 L 231 232 L 256 232 L 242 282 L 288 217 L 260 217 Z")
    $dc.DrawGeometry($boltBrush, $null, $boltGeo)

    $dc.Pop() # Pop shield clip

    # Shield border stroke on top of clipped content
    $dc.DrawGeometry($null, $shieldPen, $shieldGeo)

    if ($Type -eq "foreground") {
        $dc.Pop() # Pop foreground transform
    }

    # 6. Typography & Accent Bars (for non-foreground icons)
    if ($Type -ne "foreground") {
        $typefaceBold = New-Object System.Windows.Media.Typeface(
            (New-Object System.Windows.Media.FontFamily("Segoe UI, system-ui, -apple-system, sans-serif")),
            [System.Windows.FontStyles]::Normal,
            [System.Windows.FontWeights]::ExtraBold,
            [System.Windows.FontStretches]::Normal
        )
        $typefaceReg = New-Object System.Windows.Media.Typeface(
            (New-Object System.Windows.Media.FontFamily("Segoe UI, system-ui, -apple-system, sans-serif")),
            [System.Windows.FontStyles]::Normal,
            [System.Windows.FontWeights]::Normal,
            [System.Windows.FontStretches]::Normal
        )

        $whiteBrush = New-Object System.Windows.Media.SolidColorBrush([System.Windows.Media.Color]::FromRgb(0xf8, 0xfa, 0xfc))
        $cyanBrush = New-Object System.Windows.Media.SolidColorBrush([System.Windows.Media.Color]::FromRgb(0x38, 0xbd, 0xf8))

        $ftDfw = New-Object System.Windows.Media.FormattedText(
            "DFW",
            [System.Globalization.CultureInfo]::InvariantCulture,
            [System.Windows.FlowDirection]::LeftToRight,
            $typefaceBold,
            72,
            $whiteBrush,
            1.25
        )
        $ftMeteo = New-Object System.Windows.Media.FormattedText(
            "Meteo",
            [System.Globalization.CultureInfo]::InvariantCulture,
            [System.Windows.FlowDirection]::LeftToRight,
            $typefaceReg,
            72,
            $cyanBrush,
            1.25
        )

        $totalTextWidth = $ftDfw.Width + $ftMeteo.Width
        $startX = (512.0 - $totalTextWidth) / 2.0
        $textY = 358.0

        $dc.DrawText($ftDfw, (New-Object System.Windows.Point($startX, $textY)))
        $dc.DrawText($ftMeteo, (New-Object System.Windows.Point(($startX + $ftDfw.Width), $textY)))

        # Bars
        $orangeBarBrush = New-Object System.Windows.Media.SolidColorBrush([System.Windows.Media.Color]::FromRgb(0xf5, 0x9e, 0x0b))
        $cyanBarBrush = New-Object System.Windows.Media.SolidColorBrush([System.Windows.Media.Color]::FromArgb(160, 0x38, 0xbd, 0xf8))

        $barY = 442.0
        $dc.DrawRoundedRectangle($orangeBarBrush, $null, (New-Object System.Windows.Rect($startX, $barY, ($ftDfw.Width + 4), 8)), 4, 4)
        $dc.DrawRoundedRectangle($cyanBarBrush, $null, (New-Object System.Windows.Rect(($startX + $ftDfw.Width + 14), $barY, 40, 8)), 4, 4)
    }

    $dc.Pop() # Pop scale transform
    $dc.Close()

    $rtb = New-Object System.Windows.Media.Imaging.RenderTargetBitmap(
        $TargetSize,
        $TargetSize,
        96,
        96,
        [System.Windows.Media.PixelFormats]::Pbgra32
    )
    $rtb.Render($visual)

    $dir = [System.IO.Path]::GetDirectoryName($OutFile)
    if (-not [System.IO.Directory]::Exists($dir)) {
        [System.IO.Directory]::CreateDirectory($dir) | Out-Null
    }

    $encoder = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
    $encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($rtb))
    $outStream = [System.IO.File]::Create($OutFile)
    $encoder.Save($outStream)
    $outStream.Close()
}

$densities = @(
    @{ name = "mdpi"; launcher = 48; foreground = 108 },
    @{ name = "hdpi"; launcher = 72; foreground = 162 },
    @{ name = "xhdpi"; launcher = 96; foreground = 216 },
    @{ name = "xxhdpi"; launcher = 144; foreground = 324 },
    @{ name = "xxxhdpi"; launcher = 192; foreground = 432 }
)

Write-Host "Regenerating Android mipmap icons with exact SVG geometry..."
foreach ($d in $densities) {
    $folder = "android/app/src/main/res/mipmap-" + $d.name
    Export-DfwIcon -TargetSize $d.launcher -Type "squircle" -OutFile ($folder + "/ic_launcher.png")
    Export-DfwIcon -TargetSize $d.launcher -Type "round" -OutFile ($folder + "/ic_launcher_round.png")
    Export-DfwIcon -TargetSize $d.foreground -Type "foreground" -OutFile ($folder + "/ic_launcher_foreground.png")
    Write-Host "Generated $folder"
}

Write-Host "Regenerating PWA and Web icons..."
Export-DfwIcon -TargetSize 192 -Type "squircle" -OutFile "public/icon-192.png"
Export-DfwIcon -TargetSize 512 -Type "squircle" -OutFile "public/icon-512.png"

Write-Host "Regenerating Splash screens..."
Export-DfwIcon -TargetSize 512 -Type "splash" -OutFile "android/app/src/main/res/drawable/splash.png"
$splashFolders = @(
    "drawable-port-mdpi", "drawable-port-hdpi", "drawable-port-xhdpi", "drawable-port-xxhdpi", "drawable-port-xxxhdpi",
    "drawable-land-mdpi", "drawable-land-hdpi", "drawable-land-xhdpi", "drawable-land-xxhdpi", "drawable-land-xxxhdpi"
)
foreach ($sf in $splashFolders) {
    $p = "android/app/src/main/res/" + $sf + "/splash.png"
    Copy-Item "android/app/src/main/res/drawable/splash.png" $p -Force
}

# Update widget preview with the clean 512 squircle
Copy-Item "public/icon-512.png" "android/app/src/main/res/drawable/widget_preview.png" -Force

Write-Host "All icons regenerated with 100% exact SVG paths!"
