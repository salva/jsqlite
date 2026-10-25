"""Preserve RED normalization proof and check the single owning mapping after repair."""
import pathlib, subprocess
root=pathlib.Path(__file__).resolve().parents[3]
baseline='b40a9c5d4fa8f5f154b8585d5e136233db19eb9b'
old=subprocess.check_output(['git','show',baseline+':src/internal/pragma.ts'],cwd=root,text=True)
marker='   // pragma.c permits the WITHOUT ROWID table name as its PK index alias.'
a=old.index(marker);b=old.index(marker,a+1)
end="  }else if(name==='foreign_key_list'){"
x=old[a:old.index(end,a)];y=old[b:old.index(end,b)]
assert x.replace('check();yield ','emit(').replace(':[])];',':[])]);')==y
print('Preserved RED: baseline duplicates the whole mapping modulo check+yield versus emit.')
current=(root/'src/internal/pragma.ts').read_text()
assert current.count('const field=layout.fields[i]!,cid=')==1
assert current.count('function* indexMetadataRows(')==1
assert "if(index)yield* indexMetadataRows(index,name==='index_xinfo',check);" in current
assert "if(index)for(const values of indexMetadataRows(index,name==='index_xinfo'))emit(values);" in current
assert current.count(marker)==2 # lookup remains wrapper-owned
helper=current[current.index('function* indexMetadataRows('):current.index('/** pragma.c TABLE_INFO')]
assert helper.index('const coll=')<helper.index('check?.();')<helper.index('yield [')
print('GREEN: one field mapping, two original lookup wrappers, preserved module check placement.')
