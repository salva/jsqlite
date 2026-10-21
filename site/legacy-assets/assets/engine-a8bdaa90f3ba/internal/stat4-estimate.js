const u64 = (n) => BigInt.asUintN(64, n);
export function whereKeyStats(state, probe, roundUp) {
    const previous = probe.nField, nField = Math.min(previous, state.nSampleCol);
    if (nField < 1 || state.nSample < 1)
        throw new RangeError('KeyStats requires samples and active prefix');
    let iMin = 0, iSample = state.nSample * nField, iCol = 0, iLower = 0n, res = 0;
    try {
        do {
            probe.check(1);
            const iTest = Math.floor((iMin + iSample) / 2), iSamp = Math.floor(iTest / nField);
            let n = iSamp === 0 ? iTest + 1 : iTest % nField + 1;
            if (iSamp > 0)
                for (; n < nField; n++)
                    if (state.samples[iSamp - 1].anLt[n - 1] !== state.samples[iSamp].anLt[n - 1])
                        break;
            probe.nField = n;
            const sample = state.samples[iSamp];
            res = probe.compare(sample);
            if (res < 0) {
                iLower = u64(sample.anLt[n - 1] + sample.anEq[n - 1]);
                iMin = iTest + 1;
            }
            else if (res === 0 && n < nField) {
                iLower = sample.anLt[n - 1];
                iMin = iTest + 1;
                res = -1;
            }
            else {
                iSample = iTest;
                iCol = n - 1;
            }
        } while (res !== 0 && iMin < iSample);
        const i = Math.floor(iSample / nField);
        if (res === 0)
            return { sample: i, less: state.samples[i].anLt[iCol], equal: state.samples[i].anEq[iCol] };
        const upper = i >= state.nSample ? state.nRowEst0 : state.samples[i].anLt[iCol];
        let gap = iLower >= upper ? 0n : upper - iLower;
        gap = roundUp ? u64(gap * 2n) / 3n : gap / 3n;
        return { sample: i, less: u64(iLower + gap), equal: state.aAvgEq[nField - 1] };
    }
    finally {
        probe.nField = previous;
    }
}
