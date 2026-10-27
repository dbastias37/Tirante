"""Read mesh data from the supplied Blender 2.7x files, without executing Blender scripts."""
import gzip
import re
import struct
from pathlib import Path


class Blend:
    def __init__(self, path):
        data = Path(path).read_bytes()
        if data[:2] == b'\x1f\x8b':
            data = gzip.decompress(data)
        if data[:7] != b'BLENDER':
            raise ValueError('Not a Blender file')
        self.version = data[:12].decode()
        self.pointer = 8 if data[7:8] == b'-' else 4
        self.endian = '<' if data[8:9] == b'v' else '>'
        fmt = self.endian + ('4sIQII' if self.pointer == 8 else '4sIIII')
        header = struct.calcsize(fmt)
        self.blocks = []
        pos = 12
        while pos + header <= len(data):
            code, size, address, sdna, count = struct.unpack_from(fmt, data, pos)
            self.blocks.append(dict(code=code, size=size, address=address, sdna=sdna,
                                    count=count, data=data[pos+header:pos+header+size]))
            pos += header + size
            if code == b'ENDB':
                break
        dna = next(b['data'] for b in self.blocks if b['code'] == b'DNA1')
        pos = 8
        tables = []
        for tag in [b'NAME', b'TYPE']:
            if tag == b'TYPE':
                pos = (pos + 3) & ~3
                assert dna[pos:pos+4] == tag
                pos += 4
            count = struct.unpack_from(self.endian+'I', dna, pos)[0]
            pos += 4
            table = []
            for _ in range(count):
                end = dna.index(0, pos)
                table.append(dna[pos:end].decode())
                pos = end + 1
            tables.append(table)
        names, types = tables
        pos = (pos + 3) & ~3
        assert dna[pos:pos+4] == b'TLEN'
        pos += 4
        sizes = struct.unpack_from(self.endian+str(len(types))+'H', dna, pos)
        pos = (pos + len(types)*2 + 3) & ~3
        assert dna[pos:pos+4] == b'STRC'
        pos += 4
        count = struct.unpack_from(self.endian+'I', dna, pos)[0]
        pos += 4
        self.structs = []
        for _ in range(count):
            ti, nf = struct.unpack_from(self.endian+'HH', dna, pos)
            pos += 4
            fields, offset = {}, 0
            for _ in range(nf):
                ft, fn = struct.unpack_from(self.endian+'HH', dna, pos)
                pos += 4
                name, mult = names[fn], 1
                for n in re.findall(r'\[(\d+)\]', name):
                    mult *= int(n)
                pointer = '*' in name
                size = (self.pointer if pointer else sizes[ft])*mult
                key = re.sub(r'\[.*', '', name).replace('*', '')
                fields[key] = dict(offset=offset, size=size, type=types[ft], pointer=pointer, count=mult)
                offset += size
            self.structs.append(dict(name=types[ti], size=sizes[ti], fields=fields))
        self.types = {s['name']: s for s in self.structs}
        self.addresses = {b['address']: b for b in self.blocks}

    def field(self, data, kind, name):
        f = self.types[kind]['fields'][name]
        raw = data[f['offset']:f['offset']+f['size']]
        if f['pointer']:
            fmt = 'Q' if self.pointer == 8 else 'I'
        else:
            fmt = {'char':'b', 'uchar':'B', 'short':'h', 'ushort':'H', 'int':'i',
                   'uint':'I', 'float':'f', 'double':'d'}.get(f['type'])
            if not fmt:
                return raw
            if f['type'] == 'char' and f['count'] > 1:
                return raw.split(b'\0')[0].decode(errors='replace')
        values = struct.unpack(self.endian+fmt*f['count'], raw)
        return values[0] if len(values) == 1 else list(values)

    def rows(self, address, kind):
        block = self.addresses.get(address)
        size = self.types[kind]['size']
        return [] if block is None else [block['data'][i:i+size] for i in range(0, block['size'], size)]

    def records(self, kind):
        return [b['data'] for b in self.blocks
                if b['sdna'] < len(self.structs) and self.structs[b['sdna']]['name'] == kind]

    def name(self, data, kind):
        return self.field(self.field(data, kind, 'id'), 'ID', 'name')[2:]

    def mesh(self, name):
        data = next(d for d in self.records('Mesh') if self.name(d, 'Mesh') == name)
        f = self.field
        vertices = [f(v, 'MVert', 'co') for v in self.rows(f(data, 'Mesh', 'mvert'), 'MVert')]
        loops = [f(v, 'MLoop', 'v') for v in self.rows(f(data, 'Mesh', 'mloop'), 'MLoop')]
        uv = []
        cd = f(data, 'Mesh', 'ldata')
        for layer in self.rows(f(cd, 'CustomData', 'layers'), 'CustomDataLayer'):
            if f(layer, 'CustomDataLayer', 'type') == 16:
                uv = [f(v, 'MLoopUV', 'uv') for v in self.rows(f(layer, 'CustomDataLayer', 'data'), 'MLoopUV')]
                break
        faces, uv_faces = [], []
        for poly in self.rows(f(data, 'Mesh', 'mpoly'), 'MPoly'):
            start, n = f(poly, 'MPoly', 'loopstart'), f(poly, 'MPoly', 'totloop')
            for j in range(1, n-1):
                ids = [start, start+j, start+j+1]
                faces.append([loops[i] for i in ids])
                if uv:
                    uv_faces.append([uv[i] for i in ids])
        return vertices, faces, uv_faces

    def packed_image(self, name):
        data = next(d for d in self.records('Image') if self.name(d, 'Image') == name)
        packed = self.addresses[self.field(data, 'Image', 'packedfile')]['data']
        size = self.field(packed, 'PackedFile', 'size')
        return self.addresses[self.field(packed, 'PackedFile', 'data')]['data'][:size]
