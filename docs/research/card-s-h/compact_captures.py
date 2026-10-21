"""Development-only lossless regression rows and small exploratory summaries."""
import hashlib,json

def canonical(value):
    return json.dumps(value,ensure_ascii=True,separators=(',',':')).encode()

def regression_capture(raw):
    out=json.loads(json.dumps(raw));rowsets={}
    for variant in out['variants']:
        for profile in ['stat4','control']:
            for case in variant[profile]:
                rows=case.pop('rows');key=hashlib.sha256(canonical(rows)).hexdigest()
                if key in rowsets:assert rowsets[key]==rows
                rowsets[key]=rows;case['rowsRef']=key
    out['captureFormat']='skiprange-rowsets-v1';out['rowsets']=rowsets
    return out

def expand_capture(compact):
    out=json.loads(json.dumps(compact));assert out.pop('captureFormat')=='skiprange-rowsets-v1';rowsets=out.pop('rowsets')
    for variant in out['variants']:
        for profile in ['stat4','control']:
            for case in variant[profile]:
                key=case.pop('rowsRef');rows=rowsets[key]
                assert hashlib.sha256(canonical(rows)).hexdigest()==key
                case['rows']=rows
    return out

def search_summary(raw):
    out=json.loads(json.dumps(raw));out['captureFormat']='skiprange-search-summary-v1'
    for case in out['differences']:
        for profile in ['stat4','control']:
            rows=case[profile].pop('rows')
            case[profile]['rowCount']=len(rows)
            case[profile]['typedRowsSha256']=hashlib.sha256(canonical(rows)).hexdigest()
        assert case['stat4']['typedRowsSha256']==case['control']['typedRowsSha256']
    return out
