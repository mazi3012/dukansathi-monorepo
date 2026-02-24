import subprocess
import traceback
import platform

specs = {}
try:
    if platform.system() == "Windows":
        # Get CPU Name clearly
        cpu_cmd = "wmic cpu get name"
        cpu_res = subprocess.check_output(cpu_cmd, shell=True).decode().split('\n')[1].strip()
        if cpu_res:
            specs["cpu"] = cpu_res

        # Get GPU Info via PowerShell (More reliable for VRAM)
        ps_cmd = "powershell \"Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM\""
        gpu_res = subprocess.check_output(ps_cmd, shell=True).decode()
        
        # Parse PowerShell output
        lines = [line.strip() for line in gpu_res.split('\n') if line.strip()]
        # Skip header lines (Name/AdapterRAM and separators)
        gpu_info = []
        for line in lines:
            if "Name" in line or "----" in line:
                continue
            # Simple heuristic parsing (Name is usually first, numbers at end)
            parts = line.rsplit(' ', 1)
            if len(parts) == 2:
                name = parts[0].strip()
                try:
                    vram = int(parts[1]) / (1024**3)
                    gpu_info.append(f"{name} ({round(vram, 2)} GB)")
                    # Heuristic: Prefer dedicated GPU for specs
                    if "NVIDIA" in name or "AMD" in name and "Radeon Graphics" not in name:
                        specs["gpu"] = name
                        specs["vram_gb"] = round(vram, 2)
                except:
                    pass
        
        if "gpu" not in specs and gpu_info:
            specs["gpu"] = gpu_info[0] # Fallback to first GPU found

    print("Success:", specs)
except Exception as e:
    print("Failed!")
    traceback.print_exc()
